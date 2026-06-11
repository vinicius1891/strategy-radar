// Tipos espelhando os DTOs da API.

export type SetupStatus = 'ACTIVE' | 'ARMING' | 'NO_SETUP' | 'INVALIDATED';
export type Timeframe = '1d' | '1wk';

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

export interface Asset {
  id: string;
  ticker: string;
  name: string;
  exchange: string;
  type: string;
  currency: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ConditionResult {
  label: string;
  passed: boolean;
  role: 'filter' | 'trigger';
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

export interface RadarResponse {
  asset: Asset;
  quote: Quote;
  timeframe: Timeframe;
  strategies: StrategyEvaluation[];
  evaluatedAt: string;
}

export interface StrategyRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  timeframes: Timeframe[];
  enabled: boolean;
  isSystem: boolean;
  updatedAt: string;
  config: {
    direction: string;
    params: Record<string, number>;
    indicatorsUsed: string[];
  };
}

export interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPct: number;
  bars: number;
  exitReason: 'stop' | 'target' | 'exit_rule' | 'end_of_data';
}

export interface BacktestResponse {
  strategy: { id: string; slug: string; name: string };
  ticker: string;
  timeframe: Timeframe;
  rangeDays: number;
  candleCount: number;
  metrics: {
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
  };
  trades: BacktestTrade[];
  equityCurve: { time: number; value: number }[];
  ranAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string; name: string };
}
