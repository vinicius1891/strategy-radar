// Backtest de todas as estrategias de sistema com dados REAIS da B3 (Yahoo),
// agregando metricas por estrategia em varios tickers.
// Executar: npx tsx scripts/test-strategies-real.ts

import { runBacktest } from '../src/core/backtest';
import { SYSTEM_STRATEGIES } from '../src/core/strategy-definitions';
import { Candle } from '../src/core/types';
import { YahooProvider } from '../src/modules/market-data/yahoo.provider';

const TICKERS = ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'WEGE3', 'B3SA3', 'PRIO3', 'BOVA11'];
const RANGE_DAYS = 1095; // ~3 anos

async function main() {
  const provider = new YahooProvider();
  const series = new Map<string, Candle[]>();
  for (const t of TICKERS) {
    try {
      series.set(t, await provider.getDailyCandles(t, RANGE_DAYS));
    } catch (err) {
      console.error(`${t}: falha ao carregar — ${(err as Error).message}`);
    }
  }
  console.log(`Dados carregados: ${[...series.entries()].map(([t, c]) => `${t}(${c.length})`).join(' ')}\n`);

  const rows: {
    slug: string;
    trades: number;
    winRate: number;
    avgReturn: number;
    profitable: number;
    expectancy: number;
  }[] = [];

  for (const def of SYSTEM_STRATEGIES) {
    let trades = 0;
    let wins = 0;
    let totalReturn = 0;
    let profitable = 0;
    let expectancySum = 0;
    let tested = 0;
    for (const [, candles] of series) {
      const r = runBacktest(candles, def.config, { initialCapital: 10000 });
      trades += r.metrics.totalTrades;
      wins += r.metrics.wins;
      totalReturn += r.metrics.returnPct;
      expectancySum += r.metrics.expectancyPct * r.metrics.totalTrades;
      if (r.metrics.netProfit > 0) profitable++;
      tested++;
    }
    rows.push({
      slug: def.slug,
      trades,
      winRate: trades ? Math.round((wins / trades) * 1000) / 10 : 0,
      avgReturn: Math.round((totalReturn / tested) * 10) / 10,
      profitable,
      expectancy: trades ? Math.round((expectancySum / trades) * 100) / 100 : 0,
    });
  }

  rows.sort((a, b) => b.avgReturn - a.avgReturn);
  console.log('estrategia'.padEnd(22) + 'trades'.padStart(7) + 'win%'.padStart(7) + 'ret.medio%'.padStart(12) + 'exp.%/trade'.padStart(13) + 'lucrativa'.padStart(12));
  for (const r of rows) {
    console.log(
      r.slug.padEnd(22) +
        String(r.trades).padStart(7) +
        String(r.winRate).padStart(7) +
        String(r.avgReturn).padStart(12) +
        String(r.expectancy).padStart(13) +
        `${r.profitable}/${series.size}`.padStart(12),
    );
  }
}

main();
