// Tipos centrais do motor de regras. Estrategias sao objetos JSON puros
// interpretados dinamicamente — nenhuma estrategia possui codigo proprio.

export interface Candle {
  time: number; // epoch em segundos (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = '1d' | '1wk';

export type IndicatorName =
  | 'SMA'
  | 'EMA'
  | 'RSI'
  | 'MACD'
  | 'MACD_SIGNAL'
  | 'MACD_HIST'
  | 'ATR'
  | 'ADX'
  | 'PLUS_DI'
  | 'MINUS_DI'
  | 'BB_UPPER'
  | 'BB_MIDDLE'
  | 'BB_LOWER'
  | 'DONCHIAN_UPPER'
  | 'DONCHIAN_MIDDLE'
  | 'DONCHIAN_LOWER'
  | 'HIGHEST_HIGH'
  | 'LOWEST_LOW'
  | 'HIGHEST_CLOSE'
  | 'LOWEST_CLOSE'
  | 'VOLUME_SMA'
  | 'IBS'
  | 'ROC'
  | 'STOCH_K'
  | 'STOCH_D'
  | 'KELTNER_UPPER'
  | 'KELTNER_MIDDLE'
  | 'KELTNER_LOWER';

// Valor numerico literal ou referencia a um parametro nomeado da estrategia
export type ParamValue = number | { param: string };

export type Operand =
  | { kind: 'indicator'; name: IndicatorName; params?: Record<string, ParamValue>; offset?: number }
  | { kind: 'price'; field: 'open' | 'high' | 'low' | 'close' | 'volume'; offset?: number }
  | { kind: 'value'; value: number }
  | { kind: 'param'; name: string }
  // Referencia a um nivel ja calculado (valido apenas dentro de levels.target/levels.stop)
  | { kind: 'level'; name: 'entry' | 'stop' }
  | { kind: 'expr'; op: '+' | '-' | '*' | '/'; left: Operand; right: Operand };

export type ComparisonOp = '<' | '<=' | '>' | '>=' | '==';

export type ConditionRole = 'filter' | 'trigger';

export type Condition =
  | { kind: 'compare'; op: ComparisonOp; left: Operand; right: Operand; label: string; role?: ConditionRole }
  | { kind: 'cross'; direction: 'above' | 'below'; left: Operand; right: Operand; label: string; role?: ConditionRole }
  | { kind: 'group'; logic: 'AND' | 'OR'; conditions: Condition[]; label?: string; role?: ConditionRole };

export interface StrategyLevels {
  entry: Operand;
  stop: Operand;
  target: Operand;
  // Nivel de preco do gatilho final — usado para calcular a distancia ate a
  // entrada quando o setup esta ARMANDO. Opcional (nem todo gatilho e de preco).
  trigger?: Operand;
}

export interface StrategyConfig {
  direction: 'long';
  // Incrementar ao alterar regras/params padrao: o seeder sobrescreve a
  // config persistida quando a versao da definicao difere da armazenada
  version?: number;
  // Minimo de candles necessarios antes da primeira avaliacao
  warmup: number;
  entry: Condition;
  exit?: Condition;
  invalidation?: Condition;
  // Saida por tempo: encerra a posicao no fechamento apos N candles
  // (essencial em mean reversion — "se nao resolveu, sai")
  maxBars?: number;
  levels: StrategyLevels;
  params: Record<string, number>;
  indicatorsUsed: string[];
}

export interface StrategyDefinition {
  slug: string;
  name: string;
  description: string;
  timeframes: Timeframe[];
  config: StrategyConfig;
}

export type SetupStatus = 'ACTIVE' | 'ARMING' | 'NO_SETUP' | 'INVALIDATED';

export interface ConditionResult {
  label: string;
  passed: boolean;
  role: ConditionRole;
}

export interface StrategyEvaluation {
  strategyId: string;
  slug: string;
  name: string;
  description: string;
  status: SetupStatus;
  conditions: ConditionResult[];
  levels: { entry: number; stop: number; target: number; riskReward: number } | null;
  trigger: { level: number; currentPrice: number; distancePct: number } | null;
  timeframe: Timeframe;
  evaluatedAt: string;
}

export interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPct: number;
  bars: number;
  exitReason: 'stop' | 'target' | 'exit_rule' | 'time' | 'end_of_data';
}

export interface EquityPoint {
  time: number;
  value: number;
}

export interface BacktestMetrics {
  initialCapital: number;
  finalCapital: number;
  netProfit: number;
  returnPct: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  expectancyPct: number;
  maxDrawdownPct: number;
}

export interface BacktestResult {
  metrics: BacktestMetrics;
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
}
