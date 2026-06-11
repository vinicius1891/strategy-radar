// Seleciona a implementacao de persistencia em tempo de inicializacao:
// DATABASE_URL definido => Prisma/PostgreSQL; ausente => memoria (modo demo).

import { Global, Logger, Module, Provider } from '@nestjs/common';
import { DbSeederService } from './db-seeder.service';
import {
  MemoryAssetsRepository,
  MemoryStrategiesRepository,
  MemoryUsersRepository,
} from './memory.repositories';
import { PrismaService } from './prisma.service';
import {
  PrismaAssetsRepository,
  PrismaStrategiesRepository,
  PrismaUsersRepository,
} from './prisma.repositories';
import { ASSETS_REPOSITORY, STRATEGIES_REPOSITORY, USERS_REPOSITORY } from './repositories';

const useDatabase = Boolean(process.env.DATABASE_URL);

const providers: Provider[] = useDatabase
  ? [
      PrismaService,
      DbSeederService, // garante as estrategias/ativos no banco a cada boot
      { provide: USERS_REPOSITORY, useClass: PrismaUsersRepository },
      { provide: ASSETS_REPOSITORY, useClass: PrismaAssetsRepository },
      { provide: STRATEGIES_REPOSITORY, useClass: PrismaStrategiesRepository },
    ]
  : [
      { provide: USERS_REPOSITORY, useClass: MemoryUsersRepository },
      { provide: ASSETS_REPOSITORY, useClass: MemoryAssetsRepository },
      { provide: STRATEGIES_REPOSITORY, useClass: MemoryStrategiesRepository },
    ];

new Logger('Persistence').log(
  useDatabase ? 'Persistencia: PostgreSQL (Prisma)' : 'Persistencia: memoria (modo demo)',
);

@Global()
@Module({
  providers,
  exports: [USERS_REPOSITORY, ASSETS_REPOSITORY, STRATEGIES_REPOSITORY],
})
export class PersistenceModule {}
