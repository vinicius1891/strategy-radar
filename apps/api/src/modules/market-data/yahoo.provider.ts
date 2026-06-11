// Provider de dados reais via Yahoo Finance (endpoint publico de chart).
// Gratuito e sem token; tickers da B3 recebem sufixo ".SA" automaticamente
// (PETR4 -> PETR4.SA). Tickers com sufixo proprio ou estrangeiros passam direto.
//
// O Yahoo restringe IPs de datacenter: por isso ha multiplos hosts, aquisicao
// de cookie de consentimento (mesma tecnica de libs como yahoo-finance2) e
// retries. Falhas de rede viram 503 com log detalhado, nunca 500 generico.

import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Candle } from '../../core/types';
import { MarketDataProvider, Quote } from './provider.interface';

const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
// O Yahoo recusa requisicoes sem User-Agent de navegador
const BASE_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
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
  private cookie: string | null = null;

  // PETR4/BOVA11 etc. (4 letras + 1-2 digitos) sao B3 e precisam de ".SA";
  // simbolos ja qualificados (AAPL, PETR4.SA, ^BVSP) passam sem alteracao
  private toSymbol(ticker: string): string {
    const upper = ticker.toUpperCase();
    return /^[A-Z]{4}\d{1,2}$/.test(upper) ? `${upper}.SA` : upper;
  }

  private headers(): Record<string, string> {
    return this.cookie ? { ...BASE_HEADERS, Cookie: this.cookie } : BASE_HEADERS;
  }

  // Cookie de sessao do Yahoo: necessario para IPs que eles tratam com suspeita
  private async acquireCookie(): Promise<void> {
    try {
      const res = await fetch('https://fc.yahoo.com/', {
        headers: BASE_HEADERS,
        redirect: 'manual',
      });
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) {
        this.cookie = setCookie.split(';')[0];
        this.logger.log('Cookie de sessao do Yahoo adquirido');
      }
    } catch (err) {
      this.logger.warn(`Falha ao adquirir cookie do Yahoo: ${(err as Error).message}`);
    }
  }

  private async fetchChart(ticker: string, range: string): Promise<YahooChartResult> {
    const symbol = this.toSymbol(ticker);
    const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
    let lastDetail = 'sem resposta';

    for (let attempt = 0; attempt < 4; attempt++) {
      const host = HOSTS[attempt % HOSTS.length];
      let res: Response;
      try {
        res = await fetch(`https://${host}${path}`, { headers: this.headers() });
      } catch (err) {
        const cause = (err as { cause?: { code?: string } }).cause?.code ?? '';
        lastDetail = `falha de rede em ${host}: ${(err as Error).message} ${cause}`.trim();
        this.logger.warn(lastDetail);
        continue;
      }

      if (res.status === 404) throw new NotFoundException(`Ativo nao encontrado: ${ticker}`);

      if (res.status === 401 || res.status === 403 || res.status === 429) {
        lastDetail = `Yahoo ${res.status} em ${host} para ${symbol}`;
        this.logger.warn(`${lastDetail} — tentando com cookie`);
        await this.acquireCookie();
        continue;
      }

      if (!res.ok) {
        lastDetail = `Yahoo ${res.status} em ${host} para ${symbol}`;
        this.logger.warn(lastDetail);
        continue;
      }

      let body: { chart?: { result?: YahooChartResult[]; error?: { description?: string } } };
      try {
        body = (await res.json()) as typeof body;
      } catch {
        lastDetail = `resposta nao-JSON de ${host}`;
        this.logger.warn(lastDetail);
        continue;
      }

      const result = body.chart?.result?.[0];
      if (result) return result;

      const description = body.chart?.error?.description;
      if (description) throw new NotFoundException(`Ativo nao encontrado: ${ticker} (${description})`);
      lastDetail = `resposta vazia de ${host} para ${symbol}`;
    }

    this.logger.error(`Yahoo indisponivel para ${symbol}: ${lastDetail}`);
    throw new ServiceUnavailableException(`Provedor de dados indisponivel (${lastDetail})`);
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
