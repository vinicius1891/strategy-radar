import { Controller, DefaultValuePipe, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { normalizeTimeframe } from '../assets/assets.controller';
import { RadarService } from './radar.service';

@Controller('radar')
@UseGuards(JwtAuthGuard)
export class RadarController {
  constructor(private readonly radar: RadarService) {}

  @Get(':ticker')
  evaluate(
    @Param('ticker') ticker: string,
    @Query('timeframe', new DefaultValuePipe('1d')) timeframe: string,
  ) {
    return this.radar.evaluate(ticker, normalizeTimeframe(timeframe));
  }
}
