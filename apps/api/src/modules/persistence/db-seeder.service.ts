// Semeia as estrategias de sistema e os ativos no banco ao iniciar a aplicacao
// (apenas no modo PostgreSQL). E idempotente: roda em todo boot/deploy sem
// duplicar e sem sobrescrever ajustes de parametros feitos pelo usuario.
//
// Existe porque o deploy aplica migrations (tabelas vazias) mas nao roda o
// seed manual; sem isto, o banco de producao sobe sem nenhuma estrategia.

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SEED_ASSETS, SYSTEM_STRATEGIES } from '../../core/strategy-definitions';
import { PrismaService } from './prisma.service';

@Injectable()
export class DbSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DbSeederService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      for (const asset of SEED_ASSETS) {
        await this.prisma.asset.upsert({
          where: { ticker: asset.ticker },
          update: { name: asset.name },
          create: asset,
        });
      }

      let created = 0;
      for (const def of SYSTEM_STRATEGIES) {
        const existing = await this.prisma.strategy.findUnique({ where: { slug: def.slug } });
        if (existing) {
          // Preserva `config` (e portanto os params ajustados pelo usuario),
          // EXCETO quando a versao da definicao mudou: ai as regras novas
          // substituem a config armazenada.
          const storedVersion = (existing.config as { version?: number })?.version ?? 1;
          const defVersion = def.config.version ?? 1;
          await this.prisma.strategy.update({
            where: { slug: def.slug },
            data: {
              name: def.name,
              description: def.description,
              timeframes: def.timeframes,
              ...(storedVersion !== defVersion ? { config: def.config as object } : {}),
            },
          });
        } else {
          await this.prisma.strategy.create({
            data: {
              slug: def.slug,
              name: def.name,
              description: def.description,
              config: def.config as object,
              timeframes: def.timeframes,
              isSystem: true,
            },
          });
          created++;
        }
      }
      this.logger.log(
        `Seed concluido: ${SYSTEM_STRATEGIES.length} estrategias garantidas (${created} criadas agora), ${SEED_ASSETS.length} ativos.`,
      );
    } catch (err) {
      // Nao derruba a API se o seed falhar (ex.: banco temporariamente indisponivel)
      this.logger.error(`Falha ao semear o banco: ${(err as Error).message}`);
    }
  }
}
