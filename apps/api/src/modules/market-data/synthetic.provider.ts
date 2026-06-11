// Provider sintetico para desenvolvimento/demo: gera series OHLCV
// deterministicas por ticker (random walk geometrico com regimes),
// sem dependencia de rede. Mesmo ticker + mesmo dia => mesma serie.

import { Injectable } from '@nestjs/common';
import { Candle } from '../../core/types';
import { MarketDataProvider, Quote } from './provider.interface';

// PRNG deterministico (mulberry32)
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const DAY = 86400;
const MAX_BARS = 1825;

@Injectable()
export class SyntheticProvider implements MarketDataProvider {
  // Gera sempre a serie completa e fatia o final, para que consultas com
  // ranges diferentes (cotacao, grafico, radar, backtest) sejam consistentes.
  async getDailyCandles(ticker: string, rangeDays: number): Promise<Candle[]> {
    const all = this.generateSeries(ticker);
    return all.slice(-Math.max(Math.min(rangeDays, MAX_BARS), 30));
  }

  private generateSeries(ticker: string): Candle[] {
    const upper = ticker.toUpperCase();
    const rand = mulberry32(hashString(upper));
    const basePrice = 8 + rand() * 92; // preco inicial entre 8 e 100
    const baseVolume = 1e6 + rand() * 2e7;

    // Ancora no inicio do dia UTC atual para a serie ser estavel ao longo do dia
    const todayStart = Math.floor(Date.now() / 1000 / DAY) * DAY;
    const totalBars = MAX_BARS;

    const candles: Candle[] = [];
    let price = basePrice;
    let drift = (rand() - 0.45) * 0.002;
    for (let i = totalBars; i >= 1; i--) {
      // Troca de regime ocasional para criar tendencias e correcoes
      if (rand() < 0.03) drift = (rand() - 0.45) * 0.004;
      const vol = 0.012 + rand() * 0.015;
      const ret = drift + (rand() - 0.5) * 2 * vol;
      const open = price;
      const close = Math.max(0.5, open * (1 + ret));
      const high = Math.max(open, close) * (1 + rand() * vol * 0.8);
      const low = Math.min(open, close) * (1 - rand() * vol * 0.8);
      const volume = Math.round(baseVolume * (0.4 + rand() * 1.6) * (1 + Math.abs(ret) * 30));
      candles.push({
        time: todayStart - i * DAY,
        open: round2(open),
        high: round2(high),
        low: round2(low),
        close: round2(close),
        volume,
      });
      price = close;
    }
    return candles;
  }

  async getQuote(ticker: string): Promise<Quote> {
    const candles = await this.getDailyCandles(ticker, 30);
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2] ?? last;
    return {
      ticker: ticker.toUpperCase(),
      name: null,
      price: last.close,
      change: round2(last.close - prev.close),
      changePct: round2(((last.close - prev.close) / prev.close) * 100),
      volume: last.volume,
      currency: 'BRL',
      marketTime: new Date(last.time * 1000).toISOString(),
    };
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100;
