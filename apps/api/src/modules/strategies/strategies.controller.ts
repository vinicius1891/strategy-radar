import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StrategiesService } from './strategies.service';
import { UpdateParamsDto } from './dto';

@Controller('strategies')
@UseGuards(JwtAuthGuard)
export class StrategiesController {
  constructor(private readonly strategies: StrategiesService) {}

  @Get()
  list() {
    return this.strategies.list();
  }

  @Get(':idOrSlug')
  async get(@Param('idOrSlug') idOrSlug: string) {
    const strategy = await this.strategies.get(idOrSlug);
    if (!strategy) throw new NotFoundException('Estrategia nao encontrada');
    return strategy;
  }

  @Patch(':idOrSlug/params')
  updateParams(@Param('idOrSlug') idOrSlug: string, @Body() dto: UpdateParamsDto) {
    return this.strategies.updateParams(idOrSlug, dto.params);
  }
}
