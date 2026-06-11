import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BacktestService } from './backtest.service';
import { RunBacktestDto } from './dto';

@Controller('backtest')
@UseGuards(JwtAuthGuard)
export class BacktestController {
  constructor(private readonly backtest: BacktestService) {}

  @Post()
  run(@Body() dto: RunBacktestDto) {
    return this.backtest.run(dto);
  }
}
