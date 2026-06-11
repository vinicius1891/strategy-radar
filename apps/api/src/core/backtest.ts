// Motor de backtest: aplica uma StrategyConfig sobre o historico de candles.
// Modelo V1: long-only, 100% do capital por operacao, entrada na abertura do
// candle seguinte ao sinal, saida por stop, alvo ou regra de saida.

import { computeLevels, EvaluationContext } from './rule-engine';
import { BacktestResult, BacktestTrade, Candle, EquityPoint, StrategyConfig } from './types';

export interface BacktestOptions {
  initialCapital?: number;
}

export function runBacktest(
  candles: Candle[],
  config: StrategyConfig,
  options: BacktestOptions = {},
): BacktestResult {
  const initialCapital = options.initialCapital ?? 10000;
  const ctx = new EvaluationContext(candles, config.params);
  const trades: BacktestTrade[] = [];
  const equityCurve: EquityPoint[] = [];

  let equity = initialCapital;
  let position: {
    entryIndex: number;
    entryPrice: number;
    stop: number;
    target: number;
    quantity: number;
  } | null = null;

  const closeTrade = (
    exitIndex: number,
    exitPrice: number,
    reason: BacktestTrade['exitReason'],
  ) => {
    if (!position) return;
    const pnl = (exitPrice - position.entryPrice) * position.quantity;
    equity += pnl;
    trades.push({
      entryTime: candles[position.entryIndex].time,
      exitTime: candles[exitIndex].time,
      entryPrice: round2(position.entryPrice),
      exitPrice: round2(exitPrice),
      pnl: round2(pnl),
      pnlPct: round4(((exitPrice - position.entryPrice) / position.entryPrice) * 100),
      bars: exitIndex - position.entryIndex,
      exitReason: reason,
    });
    position = null;
  };

  const start = Math.max(config.warmup, 1);
  for (let i = start; i < candles.length; i++) {
    const candle = candles[i];

    if (position) {
      // Stop tem prioridade; gaps executam na abertura
      if (candle.open <= position.stop) {
        closeTrade(i, candle.open, 'stop');
      } else if (candle.low <= position.stop) {
        closeTrade(i, position.stop, 'stop');
      } else if (candle.open >= position.target) {
        closeTrade(i, candle.open, 'target');
      } else if (candle.high >= position.target) {
        closeTrade(i, position.target, 'target');
      } else if (config.exit && ctx.evaluateCondition(config.exit, i)) {
        closeTrade(i, candle.close, 'exit_rule');
      } else if (config.maxBars && i - position.entryIndex >= config.maxBars) {
        closeTrade(i, candle.close, 'time');
      }
    }

    if (!position && i < candles.length - 1 && ctx.evaluateCondition(config.entry, i)) {
      const levels = computeLevels(ctx, config, i);
      if (levels) {
        const entryPrice = candles[i + 1].open;
        // Mantem a distancia configurada de stop/alvo relativa ao preco real de execucao
        const stop = entryPrice - (levels.entry - levels.stop);
        const target = entryPrice + (levels.target - levels.entry);
        if (stop < entryPrice && target > entryPrice) {
          position = {
            entryIndex: i + 1,
            entryPrice,
            stop,
            target,
            quantity: equity / entryPrice,
          };
        }
      }
    }

    const markToMarket = position
      ? equity + (candle.close - position.entryPrice) * position.quantity
      : equity;
    equityCurve.push({ time: candle.time, value: round2(markToMarket) });
  }

  if (position) {
    closeTrade(candles.length - 1, candles[candles.length - 1].close, 'end_of_data');
    if (equityCurve.length > 0) {
      equityCurve[equityCurve.length - 1] = {
        time: candles[candles.length - 1].time,
        value: round2(equity),
      };
    }
  }

  return { metrics: computeMetrics(initialCapital, equity, trades, equityCurve), trades, equityCurve };
}

function computeMetrics(
  initialCapital: number,
  finalCapital: number,
  trades: BacktestTrade[],
  equityCurve: EquityPoint[],
) {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));

  let peak = initialCapital;
  let maxDd = 0;
  for (const p of equityCurve) {
    peak = Math.max(peak, p.value);
    if (peak > 0) maxDd = Math.max(maxDd, (peak - p.value) / peak);
  }

  return {
    initialCapital,
    finalCapital: round2(finalCapital),
    netProfit: round2(finalCapital - initialCapital),
    returnPct: round4(((finalCapital - initialCapital) / initialCapital) * 100),
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? round4((wins.length / trades.length) * 100) : 0,
    // 999 representa "sem perdas" (Infinity nao e serializavel em JSON)
    profitFactor: grossLoss > 0 ? round4(grossWin / grossLoss) : grossWin > 0 ? 999 : 0,
    expectancyPct: trades.length
      ? round4(trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length)
      : 0,
    maxDrawdownPct: round4(maxDd * 100),
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const round4 = (v: number) => Math.round(v * 10000) / 10000;
