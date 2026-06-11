// Implementacao em memoria (modo demo): permite rodar a aplicacao completa
// sem PostgreSQL. Estrategias de sistema e ativos vem das definicoes seed.

import { Injectable } from '@nestjs/common';
import { hashSync } from 'bcryptjs';
import { randomUUID } from 'crypto';
import { SEED_ASSETS, SYSTEM_STRATEGIES } from '../../core/strategy-definitions';
import {
  AssetRecord,
  AssetsRepository,
  StrategiesRepository,
  StrategyRecord,
  UserRecord,
  UsersRepository,
} from './repositories';

@Injectable()
export class MemoryUsersRepository implements UsersRepository {
  private users = new Map<string, UserRecord>();

  constructor() {
    const demo: UserRecord = {
      id: randomUUID(),
      email: 'demo@strategyradar.app',
      passwordHash: hashSync('demo1234', 10),
      name: 'Usuario Demo',
    };
    this.users.set(demo.id, demo);
  }

  async findByEmail(email: string) {
    return [...this.users.values()].find((u) => u.email === email.toLowerCase()) ?? null;
  }

  async findById(id: string) {
    return this.users.get(id) ?? null;
  }

  async create(data: { email: string; passwordHash: string; name: string }) {
    const user: UserRecord = { id: randomUUID(), ...data, email: data.email.toLowerCase() };
    this.users.set(user.id, user);
    return user;
  }
}

@Injectable()
export class MemoryAssetsRepository implements AssetsRepository {
  private assets = new Map<string, AssetRecord>();

  constructor() {
    for (const a of SEED_ASSETS) {
      const record: AssetRecord = { id: randomUUID(), ...a };
      this.assets.set(record.ticker, record);
    }
  }

  async findByTicker(ticker: string) {
    return this.assets.get(ticker.toUpperCase()) ?? null;
  }

  async search(query: string) {
    const q = query.toUpperCase();
    return [...this.assets.values()]
      .filter((a) => a.ticker.includes(q) || a.name.toUpperCase().includes(q))
      .slice(0, 10);
  }

  async ensure(ticker: string, name?: string | null) {
    const upper = ticker.toUpperCase();
    const existing = this.assets.get(upper);
    if (existing) return existing;
    const record: AssetRecord = {
      id: randomUUID(),
      ticker: upper,
      name: name ?? upper,
      exchange: 'B3',
      type: 'stock',
      currency: 'BRL',
    };
    this.assets.set(upper, record);
    return record;
  }
}

@Injectable()
export class MemoryStrategiesRepository implements StrategiesRepository {
  private strategies = new Map<string, StrategyRecord>();

  constructor() {
    for (const def of SYSTEM_STRATEGIES) {
      const record: StrategyRecord = {
        id: randomUUID(),
        slug: def.slug,
        name: def.name,
        description: def.description,
        config: def.config,
        timeframes: def.timeframes,
        enabled: true,
        isSystem: true,
        updatedAt: new Date().toISOString(),
      };
      this.strategies.set(record.id, record);
    }
  }

  async listAll() {
    return [...this.strategies.values()];
  }

  async findByIdOrSlug(idOrSlug: string) {
    return (
      this.strategies.get(idOrSlug) ??
      [...this.strategies.values()].find((s) => s.slug === idOrSlug) ??
      null
    );
  }

  async listEnabledForAsset(_assetId: string) {
    return [...this.strategies.values()].filter((s) => s.enabled);
  }

  async updateParams(id: string, params: Record<string, number>) {
    const record = await this.findByIdOrSlug(id);
    if (!record) throw new Error('Estrategia nao encontrada');
    record.config = { ...record.config, params: { ...record.config.params, ...params } };
    record.updatedAt = new Date().toISOString();
    return record;
  }
}
