// Provider de dados reais da B3 via brapi.dev (requer BRAPI_TOKEN para
// ranges maiores). Selecionado com MARKET_DATA_PROVIDER=brapi.

import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Candle } from '../../core/types';
import { MarketDataProvider, Quote } from './provider.interface';

interface BrapiHistorical {
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface BrapiQuoteResult {
  symbol: string;
  longName?: string;
  shortName?: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  currency?: string;
  regularMarketTime?: string;
  historicalDataPrice?: BrapiHistorical[];
}

@Injectable()
export class BrapiProvider implements MarketDataProvider {
  private readonly logger = new Logger(BrapiProvider.name);
  private readonly token: string;

  constructor(config: ConfigService) {
    this.token = config.get<string>('BRAPI_TOKEN') ?? '';
  }

  private async fetchQuote(ticker: string, range?: string): Promise<BrapiQuoteResult> {
    const params = new URLSearchParams();
    if (range) {
      params.set('range', range);
      params.set('interval', '1d');
    }
    if (this.token) params.set('token', this.token);
    const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?${params}`;
    const res = await fetch(url);
    if (res.status === 404) throw new NotFoundException(`Ativo nao encontrado: ${ticker}`);
    if (!res.ok) {
      this.logger.warn(`brapi ${res.status} para ${ticker}`);
      throw new ServiceUnavailableException('Provedor de dados indisponivel');
    }
    const body = (await res.json()) as { results?: BrapiQuoteResult[] };
    const result = body.results?.[0];
    if (!result) throw new NotFoundException(`Ativo nao encontrado: ${ticker}`);
    return result;
  }

  async getDailyCandles(ticker: string, rangeDays: number): Promise<Candle[]> {
    const range =
      rangeDays <= 95 ? '3mo' : rangeDays <= 190 ? '6mo' : rangeDays <= 400 ? '1y' : rangeDays <= 800 ? '2y' : '5y';
    const result = await this.fetchQuote(ticker, range);
    const history = result.historicalDataPrice ?? [];
    return history
      .filter((h) => h.close != null && h.open != null)
      .map((h) => ({
        time: h.date,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume ?? 0,
      }))
      .sort((a, b) => a.time - b.time);
  }

  async getQuote(ticker: string): Promise<Quote> {
    const r = await this.fetchQuote(ticker);
    return {
      ticker: r.symbol,
      name: r.longName ?? r.shortName ?? null,
      price: r.regularMarketPrice,
      change: r.regularMarketChange,
      changePct: r.regularMarketChangePercent,
      volume: r.regularMarketVolume,
      currency: r.currency ?? 'BRL',
      marketTime: r.regularMarketTime ?? new Date().toISOString(),
    };
  }
}
