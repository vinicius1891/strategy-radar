import { Candle } from '../../core/types';

export interface Quote {
  ticker: string;
  name: string | null;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  currency: string;
  marketTime: string;
}

export interface MarketDataProvider {
  // Candles diarios; agregacoes (semanal) sao derivadas pelo MarketDataService
  getDailyCandles(ticker: string, rangeDays: number): Promise<Candle[]>;
  getQuote(ticker: string): Promise<Quote>;
}

export const MARKET_DATA_PROVIDER = Symbol('MARKET_DATA_PROVIDER');
