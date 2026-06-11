// Contratos de persistencia. Ha duas implementacoes: Prisma/PostgreSQL
// (producao) e memoria (modo demo, quando DATABASE_URL nao esta definido).

import { StrategyConfig, Timeframe } from '../../core/types';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
}

export interface AssetRecord {
  id: string;
  ticker: string;
  name: string;
  exchange: string;
  type: string;
  currency: string;
}

export interface StrategyRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  config: StrategyConfig;
  timeframes: Timeframe[];
  enabled: boolean;
  isSystem: boolean;
  updatedAt: string;
}

export interface UsersRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(data: { email: string; passwordHash: string; name: string }): Promise<UserRecord>;
}

export interface AssetsRepository {
  findByTicker(ticker: string): Promise<AssetRecord | null>;
  search(query: string): Promise<AssetRecord[]>;
  // Registra o ativo sob demanda na primeira consulta (sistema orientado a demanda)
  ensure(ticker: string, name?: string | null): Promise<AssetRecord>;
}

export interface StrategiesRepository {
  listAll(): Promise<StrategyRecord[]>;
  findByIdOrSlug(idOrSlug: string): Promise<StrategyRecord | null>;
  // Estrategias cadastradas para um ativo; sem vinculos explicitos,
  // retorna todas as estrategias de sistema habilitadas (padrao da V1)
  listEnabledForAsset(assetId: string): Promise<StrategyRecord[]>;
  updateParams(id: string, params: Record<string, number>): Promise<StrategyRecord>;
}

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');
export const ASSETS_REPOSITORY = Symbol('ASSETS_REPOSITORY');
export const STRATEGIES_REPOSITORY = Symbol('STRATEGIES_REPOSITORY');
