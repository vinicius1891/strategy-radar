// Seed do banco: usuario demo, ativos B3 e as 10 estrategias de sistema.
// Executar com: npm run prisma:seed -w apps/api

import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { SEED_ASSETS, SYSTEM_STRATEGIES } from '../src/core/strategy-definitions';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: 'demo@strategyradar.app' },
    update: {},
    create: {
      email: 'demo@strategyradar.app',
      name: 'Usuario Demo',
      passwordHash: hashSync('demo1234', 10),
    },
  });

  for (const asset of SEED_ASSETS) {
    await prisma.asset.upsert({
      where: { ticker: asset.ticker },
      update: { name: asset.name },
      create: asset,
    });
  }

  for (const def of SYSTEM_STRATEGIES) {
    await prisma.strategy.upsert({
      where: { slug: def.slug },
      update: {
        name: def.name,
        description: def.description,
        config: def.config as object,
        timeframes: def.timeframes,
      },
      create: {
        slug: def.slug,
        name: def.name,
        description: def.description,
        config: def.config as object,
        timeframes: def.timeframes,
        isSystem: true,
      },
    });
  }

  console.log(`Seed concluido: ${SEED_ASSETS.length} ativos, ${SYSTEM_STRATEGIES.length} estrategias.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
