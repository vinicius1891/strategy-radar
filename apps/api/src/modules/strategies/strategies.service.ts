import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { STRATEGIES_REPOSITORY, StrategiesRepository } from '../persistence/repositories';
import { RadarService } from '../radar/radar.service';

@Injectable()
export class StrategiesService {
  constructor(
    @Inject(STRATEGIES_REPOSITORY) private readonly strategies: StrategiesRepository,
    private readonly radar: RadarService,
  ) {}

  list() {
    return this.strategies.listAll();
  }

  get(idOrSlug: string) {
    return this.strategies.findByIdOrSlug(idOrSlug);
  }

  async updateParams(idOrSlug: string, params: Record<string, number>) {
    const existing = await this.strategies.findByIdOrSlug(idOrSlug);
    if (!existing) throw new NotFoundException('Estrategia nao encontrada');
    for (const [key, value] of Object.entries(params)) {
      if (!(key in existing.config.params)) {
        throw new BadRequestException(`Parametro desconhecido: ${key}`);
      }
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new BadRequestException(`Valor invalido para ${key}`);
      }
    }
    const updated = await this.strategies.updateParams(existing.id, params);
    // Configuracao mudou: resultados de radar cacheados ficam invalidos
    await this.radar.invalidateAll();
    return updated;
  }
}
