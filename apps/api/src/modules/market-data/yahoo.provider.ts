// Provider de dados reais via Yahoo Finance (endpoint publico de chart).
// Gratuito e sem token; tickers da B3 recebem sufixo ".SA" automaticamente
// (PETR4 -> PETR4.SA). Tickers com sufixo proprio ou estrangeiros passam direto.

import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Candle } from '../../core/types';
import { MarketDataProvider, Quote } from './provider.interface';

const BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
// O Yahoo recusa requisicoes sem User-Agent de navegador
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json',
};

interface YahooChartResult {
  meta: {
    symbol: string;
    currency?: string;
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    previousClose?: number;
    regularMarketTime?: number;
    longName?: string;
    shortName?: string;
  };
  timestamp?: number[];
  indicators: {
    quote: Array<{
      open: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
      close: (number | null)[];
      volume: (number | null)[];
    }>;
  };
}

@Injectable()
export class YahooProvider implements MarketDataProvider {
  private readonly logger = new Logger(YahooProvider.name);

  // PETR4/BOVA11 etc. (4 letras + 1-2 digitos) sao B3 e precisam de ".SA";
  // simbolos ja qualificados (AAPL, PETR4.SA, ^BVSP) passam sem alteracao
  private toSymbol(ticker: string): string {
    const upper = ticker.toUpperCase();
    return /^[A-Z]{4}\d{1,2}$/.test(upper) ? `${upper}.SA` : upper;
  }

  private async fetchChart(ticker: string, range: string): Promise<YahooChartResult> {
    const symbol = this.toSymbol(ticker);
    const url = `${BASE}/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
    const res = await fetch(url, { headers: HEADERS });
    if (res.status === 404) throw new NotFoundException(`Ativo nao encontrado: ${ticker}`);
    if (!res.ok) {
      this.logger.warn(`Yahoo ${res.status} para ${symbol}`);
      throw new ServiceUnavailableException('Provedor de dados indisponivel');
    }
    const body = (await res.json()) as {
      chart?: { result?: YahooChartResult[]; error?: { description?: string } };
    };
    const result = body.chart?.result?.[0];
    if (!result) {
      throw new NotFoundException(
        `Ativo nao encontrado: ${ticker}${body.chart?.error?.description ? ` (${body.chart.error.description})` : ''}`,
      );
    }
    return result;
  }

  async getDailyCandles(ticker: string, rangeDays: number): Promise<Candle[]> {
    const range =
      rangeDays <= 95 ? '3mo' : rangeDays <= 190 ? '6mo' : rangeDays <= 400 ? '1y' : rangeDays <= 800 ? '2y' : '5y';
    const result = await this.fetchChart(ticker, range);
    const ts = result.timestamp ?? [];
    const q = result.indicators.quote[0];
    const candles: Candle[] = [];
    for (let i = 0; i < ts.length; i++) {
      const open = q.open[i];
      const high = q.high[i];
      const low = q.low[i];
      const close = q.close[i];
      if (open == null || high == null || low == null || close == null) continue;
      candles.push({
        time: ts[i],
        open: round4(open),
        high: round4(high),
        low: round4(low),
        close: round4(close),
        volume: q.volume[i] ?? 0,
      });
    }
    return candles.sort((a, b) => a.time - b.time);
  }

  async getQuote(ticker: string): Promise<Quote> {
    const result = await this.fetchChart(ticker, '5d');
    const meta = result.meta;
    const q = result.indicators.quote[0];
    const lastVolume = [...(q?.volume ?? [])].reverse().find((v) => v != null) ?? 0;
    const price = meta.regularMarketPrice ?? 0;
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
    return {
      ticker: ticker.toUpperCase(),
      name: meta.longName ?? meta.shortName ?? null,
      price: round4(price),
      change: round4(price - prev),
      changePct: prev ? round4(((price - prev) / prev) * 100) : 0,
      volume: lastVolume,
      currency: meta.currency ?? 'BRL',
      marketTime: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(),
    };
  }
}

const round4 = (v: number) => Math.round(v * 10000) / 10000;
