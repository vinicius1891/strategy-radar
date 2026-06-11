// Motor de regras: interpreta StrategyConfig (JSON) sobre uma serie de candles.
// Nao ha codigo especifico por estrategia — condicoes, niveis e parametros
// sao resolvidos dinamicamente a partir do objeto de configuracao.

import * as ind from './indicators';
import {
  Candle,
  Condition,
  ConditionResult,
  Operand,
  ParamValue,
  SetupStatus,
  StrategyConfig,
} from './types';

type LevelContext = { entry?: number; stop?: number };

export class EvaluationContext {
  private seriesCache = new Map<string, number[]>();

  constructor(
    public readonly candles: Candle[],
    private readonly params: Record<string, number>,
  ) {}

  private resolveParam(v: ParamValue | undefined, fallback: number): number {
    if (v === undefined) return fallback;
    if (typeof v === 'number') return v;
    const resolved = this.params[v.param];
    if (resolved === undefined) throw new Error(`Parametro nao definido: ${v.param}`);
    return resolved;
  }

  private priceSeries(field: 'open' | 'high' | 'low' | 'close' | 'volume'): number[] {
    const key = `price:${field}`;
    let s = this.seriesCache.get(key);
    if (!s) {
      s = this.candles.map((c) => c[field]);
      this.seriesCache.set(key, s);
    }
    return s;
  }

  // Serie completa de um indicador, memoizada por nome+parametros resolvidos
  indicatorSeries(name: string, rawParams?: Record<string, ParamValue>): number[] {
    const p = (k: string, d: number) => this.resolveParam(rawParams?.[k], d);
    const compute = (): number[] => {
      const closes = this.priceSeries('close');
      switch (name) {
        case 'SMA':
          return ind.sma(closes, p('period', 20));
        case 'EMA':
          return ind.ema(closes, p('period', 21));
        case 'RSI':
          return ind.rsi(closes, p('period', 14));
        case 'MACD':
          return ind.macd(closes, p('fast', 12), p('slow', 26), p('signal', 9)).line;
        case 'MACD_SIGNAL':
          return ind.macd(closes, p('fast', 12), p('slow', 26), p('signal', 9)).signal;
        case 'MACD_HIST':
          return ind.macd(closes, p('fast', 12), p('slow', 26), p('signal', 9)).hist;
        case 'ATR':
          return ind.atr(this.candles, p('period', 14));
        case 'ADX':
          return ind.dmi(this.candles, p('period', 14)).adx;
        case 'PLUS_DI':
          return ind.dmi(this.candles, p('period', 14)).plusDi;
        case 'MINUS_DI':
          return ind.dmi(this.candles, p('period', 14)).minusDi;
        case 'BB_UPPER':
          return ind.bollinger(closes, p('period', 20), p('mult', 2)).upper;
        case 'BB_MIDDLE':
          return ind.bollinger(closes, p('period', 20), p('mult', 2)).middle;
        case 'BB_LOWER':
          return ind.bollinger(closes, p('period', 20), p('mult', 2)).lower;
        case 'DONCHIAN_UPPER':
          return ind.donchian(this.candles, p('period', 20)).upper;
        case 'DONCHIAN_MIDDLE':
          return ind.donchian(this.candles, p('period', 20)).middle;
        case 'DONCHIAN_LOWER':
          return ind.donchian(this.candles, p('period', 20)).lower;
        case 'HIGHEST_HIGH':
          return ind.highest(this.priceSeries('high'), p('period', 20));
        case 'LOWEST_LOW':
          return ind.lowest(this.priceSeries('low'), p('period', 20));
        case 'VOLUME_SMA':
          return ind.sma(this.priceSeries('volume'), p('period', 20));
        default:
          throw new Error(`Indicador desconhecido: ${name}`);
      }
    };
    const resolved: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawParams ?? {})) resolved[k] = this.resolveParam(v, NaN);
    const key = `${name}:${JSON.stringify(resolved)}`;
    let s = this.seriesCache.get(key);
    if (!s) {
      s = compute();
      this.seriesCache.set(key, s);
    }
    return s;
  }

  // Valor de um operando no indice i
  valueAt(operand: Operand, i: number, levels: LevelContext = {}): number {
    switch (operand.kind) {
      case 'value':
        return operand.value;
      case 'param': {
        const v = this.params[operand.name];
        if (v === undefined) throw new Error(`Parametro nao definido: ${operand.name}`);
        return v;
      }
      case 'level': {
        const v = levels[operand.name];
        if (v === undefined) throw new Error(`Nivel nao calculado: ${operand.name}`);
        return v;
      }
      case 'price': {
        const idx = i - (operand.offset ?? 0);
        if (idx < 0) return NaN;
        return this.priceSeries(operand.field)[idx];
      }
      case 'indicator': {
        const idx = i - (operand.offset ?? 0);
        if (idx < 0) return NaN;
        return this.indicatorSeries(operand.name, operand.params)[idx];
      }
      case 'expr': {
        const l = this.valueAt(operand.left, i, levels);
        const r = this.valueAt(operand.right, i, levels);
        switch (operand.op) {
          case '+':
            return l + r;
          case '-':
            return l - r;
          case '*':
            return l * r;
          case '/':
            return r === 0 ? NaN : l / r;
        }
      }
    }
  }

  evaluateCondition(cond: Condition, i: number): boolean {
    switch (cond.kind) {
      case 'compare': {
        const l = this.valueAt(cond.left, i);
        const r = this.valueAt(cond.right, i);
        if (Number.isNaN(l) || Number.isNaN(r)) return false;
        switch (cond.op) {
          case '<':
            return l < r;
          case '<=':
            return l <= r;
          case '>':
            return l > r;
          case '>=':
            return l >= r;
          case '==':
            return l === r;
        }
        return false;
      }
      case 'cross': {
        if (i < 1) return false;
        const lPrev = this.valueAt(cond.left, i - 1);
        const rPrev = this.valueAt(cond.right, i - 1);
        const lNow = this.valueAt(cond.left, i);
        const rNow = this.valueAt(cond.right, i);
        if ([lPrev, rPrev, lNow, rNow].some(Number.isNaN)) return false;
        return cond.direction === 'above'
          ? lPrev <= rPrev && lNow > rNow
          : lPrev >= rPrev && lNow < rNow;
      }
      case 'group': {
        const results = cond.conditions.map((c) => this.evaluateCondition(c, i));
        return cond.logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
      }
    }
  }

  // Achata a arvore de condicoes em folhas avaliadas (grupos OR viram uma folha unica)
  flattenResults(cond: Condition, i: number): ConditionResult[] {
    if (cond.kind === 'group' && cond.logic === 'AND') {
      return cond.conditions.flatMap((c) => this.flattenResults(c, i));
    }
    if (cond.kind === 'group') {
      return [
        {
          label: cond.label ?? 'Uma das condicoes alternativas',
          passed: this.evaluateCondition(cond, i),
          role: cond.role ?? 'filter',
        },
      ];
    }
    return [
      {
        label: cond.label,
        passed: this.evaluateCondition(cond, i),
        role: cond.role ?? 'filter',
      },
    ];
  }
}

export interface EngineEvaluation {
  status: SetupStatus;
  conditions: ConditionResult[];
  levels: { entry: number; stop: number; target: number; riskReward: number } | null;
  trigger: { level: number; currentPrice: number; distancePct: number } | null;
}

export function computeLevels(
  ctx: EvaluationContext,
  config: StrategyConfig,
  i: number,
): { entry: number; stop: number; target: number; riskReward: number } | null {
  const levelCtx: LevelContext = {};
  const entry = ctx.valueAt(config.levels.entry, i, levelCtx);
  levelCtx.entry = entry;
  const stop = ctx.valueAt(config.levels.stop, i, levelCtx);
  levelCtx.stop = stop;
  const target = ctx.valueAt(config.levels.target, i, levelCtx);
  if ([entry, stop, target].some((v) => Number.isNaN(v) || !Number.isFinite(v))) return null;
  const risk = entry - stop;
  const reward = target - entry;
  if (risk <= 0) return null;
  return {
    entry: round2(entry),
    stop: round2(stop),
    target: round2(target),
    riskReward: Math.round((reward / risk) * 100) / 100,
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

// Avalia o estado do setup no ultimo candle da serie
export function evaluateStrategy(candles: Candle[], config: StrategyConfig): EngineEvaluation {
  const i = candles.length - 1;
  const empty: EngineEvaluation = { status: 'NO_SETUP', conditions: [], levels: null, trigger: null };
  if (i < 0 || candles.length < config.warmup) return empty;

  const ctx = new EvaluationContext(candles, config.params);
  const conditions = ctx.flattenResults(config.entry, i);

  if (config.invalidation && ctx.evaluateCondition(config.invalidation, i)) {
    return { status: 'INVALIDATED', conditions, levels: null, trigger: null };
  }

  const levels = computeLevels(ctx, config, i);
  const entryPassed = ctx.evaluateCondition(config.entry, i);

  if (entryPassed) {
    return { status: 'ACTIVE', conditions, levels, trigger: null };
  }

  // ARMANDO: filtros completos faltando apenas o gatilho, ou (sem roles
  // definidos) ao menos 2/3 das condicoes atendidas.
  const triggers = conditions.filter((c) => c.role === 'trigger');
  const filters = conditions.filter((c) => c.role === 'filter');
  let arming = false;
  if (triggers.length > 0) {
    arming = filters.every((c) => c.passed) && triggers.some((c) => !c.passed);
  } else if (conditions.length > 0) {
    arming = conditions.filter((c) => c.passed).length / conditions.length >= 2 / 3;
  }

  if (arming) {
    let trigger: EngineEvaluation['trigger'] = null;
    if (config.levels.trigger) {
      const level = ctx.valueAt(config.levels.trigger, i);
      const currentPrice = candles[i].close;
      if (Number.isFinite(level) && !Number.isNaN(level) && currentPrice > 0) {
        trigger = {
          level: round2(level),
          currentPrice: round2(currentPrice),
          distancePct: Math.round(((level - currentPrice) / currentPrice) * 10000) / 100,
        };
      }
    }
    return { status: 'ARMING', conditions, levels, trigger };
  }

  return { status: 'NO_SETUP', conditions, levels: null, trigger: null };
}
