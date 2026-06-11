// Radar de Estrategias — nucleo do produto. Executa, sob demanda, todas as
// estrategias cadastradas para UM ativo e classifica cada setup. Resultados
// sao cacheados; nenhuma varredura global de mercado acontece aqui.

import { Inject, Injectable } from '@nestjs/common';
import { evaluateStrategy } from '../../core/rule-engine';
import { StrategyEvaluation, Timeframe } from '../../core/types';
import { CacheService } from '../cache/cache.service';
import { MarketDataService } from '../market-data/market-data.service';
import {
  ASSETS_REPOSITORY,
  AssetsRepository,
  STRATEGIES_REPOSITORY,
  StrategiesRepository,
} from '../persistence/repositories';

const RADAR_TTL = 60; // segundos

// Dias de historico diario suficientes para o maior warmup (210 barras):
// diario com folga; semanal precisa de ~5 anos para 210 semanas.
const RANGE_DAYS: Record<Timeframe, number> = { '1d': 500, '1wk': 1825 };

const STATUS_ORDER = { ACTIVE: 0, ARMING: 1, NO_SETUP: 2, INVALIDATED: 3 } as const;

@Injectable()
export class RadarService {
  constructor(
    @Inject(ASSETS_REPOSITORY) private readonly assets: AssetsRepository,
    @Inject(STRATEGIES_REPOSITORY) private readonly strategies: StrategiesRepository,
    private readonly marketData: MarketDataService,
    private readonly cache: CacheService,
  ) {}

  async evaluate(ticker: string, timeframe: Timeframe) {
    const key = `radar:${ticker.toUpperCase()}:${timeframe}`;
    return this.cache.getOrSet(key, RADAR_TTL, async () => {
      const quote = await this.marketData.getQuote(ticker);
      const asset = await this.assets.ensure(quote.ticker, quote.name);
      const [candles, registered] = await Promise.all([
        this.marketData.getCandles(ticker, timeframe, RANGE_DAYS[timeframe]),
        this.strategies.listEnabledForAsset(asset.id),
      ]);

      const compatible = registered.filter((s) => s.timeframes.includes(timeframe));
      const evaluations: StrategyEvaluation[] = compatible.map((s) => {
        const result = evaluateStrategy(candles, s.config);
        return {
          strategyId: s.id,
          slug: s.slug,
          name: s.name,
          description: s.description,
          status: result.status,
          conditions: result.conditions,
          levels: result.levels,
          trigger: result.trigger,
          timeframe,
          evaluatedAt: new Date().toISOString(),
        };
      });

      evaluations.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

      return {
        asset,
        quote,
        timeframe,
        strategies: evaluations,
        evaluatedAt: new Date().toISOString(),
      };
    });
  }

  // Chamado quando uma estrategia muda — resultados cacheados ficam obsoletos
  invalidateAll() {
    return this.cache.invalidatePrefix('radar:');
  }
}
