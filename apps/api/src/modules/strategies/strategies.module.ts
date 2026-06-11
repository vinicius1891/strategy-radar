import { Module } from '@nestjs/common';
import { RadarModule } from '../radar/radar.module';
import { StrategiesController } from './strategies.controller';
import { StrategiesService } from './strategies.service';

@Module({
  imports: [RadarModule],
  controllers: [StrategiesController],
  providers: [StrategiesService],
})
export class StrategiesModule {}
