// Fachada de dados de mercado com cache obrigatorio: toda leitura de candles
// ou cotacao passa por aqui. Nada e processado sem demanda do usuario.

import { Inject, Injectable } from '@nestjs/common';
import { Candle, Timeframe } from '../../core/types';
import { CacheService } from '../cache/cache.service';
import { MARKET_DATA_PROVIDER, MarketDataProvider, Quote } from './provider.interface';

const QUOTE_TTL = 60; // 1 min
const CANDLES_TTL = 300; // 5 min (candles diarios mudam pouco intraday)

@Injectable()
export class MarketDataService {
  constructor(
    @Inject(MARKET_DATA_PROVIDER) private readonly provider: MarketDataProvider,
    private readonly cache: CacheService,
  ) {}

  async getQuote(ticker: string): Promise<Quote> {
    const key = `quote:${ticker.toUpperCase()}`;
    return this.cache.getOrSet(key, QUOTE_TTL, () => this.provider.getQuote(ticker));
  }

  async getCandles(ticker: string, timeframe: Timeframe, rangeDays: number): Promise<Candle[]> {
    const key = `candles:${ticker.toUpperCase()}:${timeframe}:${rangeDays}`;
    return this.cache.getOrSet(key, CANDLES_TTL, async () => {
      const daily = await this.provider.getDailyCandles(ticker, rangeDays);
      return timeframe === '1wk' ? aggregateWeekly(daily) : daily;
    });
  }
}

// Agrega candles diarios em semanais (semana ISO, segunda-feira como ancora)
function aggregateWeekly(daily: Candle[]): Candle[] {
  const weeks = new Map<number, Candle>();
  for (const c of daily) {
    const date = new Date(c.time * 1000);
    const day = date.getUTCDay();
    const diffToMonday = (day + 6) % 7;
    const monday = Math.floor(c.time / 86400) * 86400 - diffToMonday * 86400;
    const existing = weeks.get(monday);
    if (!existing) {
      weeks.set(monday, { ...c, time: monday });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
      existing.volume += c.volume;
    }
  }
  return [...weeks.values()].sort((a, b) => a.time - b.time);
}
