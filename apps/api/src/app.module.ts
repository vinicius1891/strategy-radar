import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssetsModule } from './modules/assets/assets.module';
import { AuthModule } from './modules/auth/auth.module';
import { BacktestModule } from './modules/backtest/backtest.module';
import { AppCacheModule } from './modules/cache/cache.module';
import { MarketDataModule } from './modules/market-data/market-data.module';
import { PersistenceModule } from './modules/persistence/persistence.module';
import { RadarModule } from './modules/radar/radar.module';
import { StrategiesModule } from './modules/strategies/strategies.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppCacheModule,
    PersistenceModule,
    MarketDataModule,
    AuthModule,
    AssetsModule,
    StrategiesModule,
    RadarModule,
    BacktestModule,
  ],
})
export class AppModule {}
