// Backtest sob demanda de uma estrategia sobre um ativo, com cache.

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { runBacktest } from '../../core/backtest';
import { Timeframe } from '../../core/types';
import { CacheService } from '../cache/cache.service';
import { MarketDataService } from '../market-data/market-data.service';
import { STRATEGIES_REPOSITORY, StrategiesRepository } from '../persistence/repositories';
import { RunBacktestDto } from './dto';

const BACKTEST_TTL = 600; // 10 min

@Injectable()
export class BacktestService {
  constructor(
    @Inject(STRATEGIES_REPOSITORY) private readonly strategies: StrategiesRepository,
    private readonly marketData: MarketDataService,
    private readonly cache: CacheService,
  ) {}

  async run(dto: RunBacktestDto) {
    const strategy = await this.strategies.findByIdOrSlug(dto.strategy);
    if (!strategy) throw new NotFoundException('Estrategia nao encontrada');

    const timeframe: Timeframe = dto.timeframe ?? '1d';
    const rangeDays = dto.rangeDays ?? (timeframe === '1wk' ? 1825 : 730);
    const initialCapital = dto.initialCapital ?? 10000;
    const ticker = dto.ticker.toUpperCase();

    // updatedAt na chave garante invalidacao automatica quando a estrategia muda
    const key = `backtest:${strategy.id}:${strategy.updatedAt}:${ticker}:${timeframe}:${rangeDays}:${initialCapital}`;
    return this.cache.getOrSet(key, BACKTEST_TTL, async () => {
      const candles = await this.marketData.getCandles(ticker, timeframe, rangeDays);
      const result = runBacktest(candles, strategy.config, { initialCapital });
      return {
        strategy: { id: strategy.id, slug: strategy.slug, name: strategy.name },
        ticker,
        timeframe,
        rangeDays,
        candleCount: candles.length,
        ...result,
        ranAt: new Date().toISOString(),
      };
    });
  }
}
