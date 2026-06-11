// Camada de cache unica do sistema. Usa Redis quando REDIS_URL esta definido;
// caso contrario, fallback LRU em memoria com TTL (modo demo / dev).

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

const MEMORY_MAX_ENTRIES = 2000;

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private memory = new Map<string, MemoryEntry>();

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL');
    if (url) {
      this.redis = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
      this.redis.on('error', (err) => this.logger.warn(`Redis indisponivel: ${err.message}`));
      this.logger.log('Cache: Redis');
    } else {
      this.logger.log('Cache: memoria (defina REDIS_URL para usar Redis)');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(key);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    }
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }
    // LRU: reinsere para o final da ordem de iteracao
    this.memory.delete(key);
    this.memory.set(key, entry);
    return JSON.parse(entry.value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const raw = JSON.stringify(value);
    if (this.redis) {
      try {
        await this.redis.set(key, raw, 'EX', ttlSeconds);
      } catch {
        /* cache e best-effort */
      }
      return;
    }
    if (this.memory.size >= MEMORY_MAX_ENTRIES) {
      const oldest = this.memory.keys().next().value;
      if (oldest) this.memory.delete(oldest);
    }
    this.memory.set(key, { value: raw, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  // Computa apenas em cache miss — padrao usado por todas as consultas
  async getOrSet<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  // Invalidacao por prefixo — usada quando uma estrategia e alterada
  async invalidatePrefix(prefix: string): Promise<void> {
    if (this.redis) {
      try {
        const stream = this.redis.scanStream({ match: `${prefix}*`, count: 200 });
        for await (const keys of stream) {
          if ((keys as string[]).length) await this.redis.del(...(keys as string[]));
        }
      } catch {
        /* best-effort */
      }
      return;
    }
    for (const key of [...this.memory.keys()]) {
      if (key.startsWith(prefix)) this.memory.delete(key);
    }
  }

  async onModuleDestroy() {
    if (this.redis) await this.redis.quit().catch(() => undefined);
  }
}
