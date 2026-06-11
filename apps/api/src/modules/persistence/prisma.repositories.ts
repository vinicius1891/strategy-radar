// Implementacao Prisma/PostgreSQL dos repositorios.

import { Injectable } from '@nestjs/common';
import { StrategyConfig, Timeframe } from '../../core/types';
import { PrismaService } from './prisma.service';
import {
  AssetsRepository,
  StrategiesRepository,
  StrategyRecord,
  UsersRepository,
} from './repositories';

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: { email: string; passwordHash: string; name: string }) {
    return this.prisma.user.create({ data: { ...data, email: data.email.toLowerCase() } });
  }
}

@Injectable()
export class PrismaAssetsRepository implements AssetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTicker(ticker: string) {
    return this.prisma.asset.findUnique({ where: { ticker: ticker.toUpperCase() } });
  }

  search(query: string) {
    return this.prisma.asset.findMany({
      where: {
        OR: [
          { ticker: { contains: query.toUpperCase() } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
    });
  }

  ensure(ticker: string, name?: string | null) {
    const upper = ticker.toUpperCase();
    return this.prisma.asset.upsert({
      where: { ticker: upper },
      update: name ? { name } : {},
      create: { ticker: upper, name: name ?? upper },
    });
  }
}

@Injectable()
export class PrismaStrategiesRepository implements StrategiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(s: {
    id: string;
    slug: string;
    name: string;
    description: string;
    config: unknown;
    timeframes: string[];
    enabled: boolean;
    isSystem: boolean;
    updatedAt: Date;
  }): StrategyRecord {
    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      description: s.description,
      config: s.config as unknown as StrategyConfig,
      timeframes: s.timeframes as Timeframe[],
      enabled: s.enabled,
      isSystem: s.isSystem,
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  async listAll() {
    const rows = await this.prisma.strategy.findMany({ orderBy: { name: 'asc' } });
    return rows.map((r) => this.toRecord(r));
  }

  async findByIdOrSlug(idOrSlug: string) {
    const row = await this.prisma.strategy.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
    return row ? this.toRecord(row) : null;
  }

  async listEnabledForAsset(assetId: string) {
    const links = await this.prisma.assetStrategy.findMany({
      where: { assetId, enabled: true },
      include: { strategy: true },
    });
    if (links.length > 0) {
      return links.filter((l) => l.strategy.enabled).map((l) => this.toRecord(l.strategy));
    }
    // Sem vinculos explicitos: padrao = todas as estrategias de sistema habilitadas
    const rows = await this.prisma.strategy.findMany({ where: { enabled: true, isSystem: true } });
    return rows.map((r) => this.toRecord(r));
  }

  async updateParams(id: string, params: Record<string, number>) {
    const existing = await this.findByIdOrSlug(id);
    if (!existing) throw new Error('Estrategia nao encontrada');
    const config = { ...existing.config, params: { ...existing.config.params, ...params } };
    const row = await this.prisma.strategy.update({
      where: { id: existing.id },
      data: { config: config as object },
    });
    return this.toRecord(row);
  }
}
