import {
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Timeframe } from '../../core/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AssetsService } from './assets.service';

@Controller('assets')
@UseGuards(JwtAuthGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get('search')
  search(@Query('q') q?: string) {
    if (!q || q.trim().length < 1) return [];
    return this.assets.search(q.trim());
  }

  @Get(':ticker')
  getOverview(@Param('ticker') ticker: string) {
    if (!/^[A-Za-z0-9.\-]{2,12}$/.test(ticker)) throw new NotFoundException('Ticker invalido');
    return this.assets.getOverview(ticker);
  }

  @Get(':ticker/candles')
  getCandles(
    @Param('ticker') ticker: string,
    @Query('timeframe', new DefaultValuePipe('1d')) timeframe: Timeframe,
    @Query('range', new DefaultValuePipe(420), ParseIntPipe) range: number,
  ) {
    return this.assets.getCandles(ticker, normalizeTimeframe(timeframe), clampRange(range));
  }
}

export function normalizeTimeframe(tf: string): Timeframe {
  return tf === '1wk' ? '1wk' : '1d';
}

export function clampRange(range: number): number {
  return Math.min(Math.max(range, 30), 1825);
}
