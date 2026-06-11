import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrapiProvider } from './brapi.provider';
import { MarketDataService } from './market-data.service';
import { MARKET_DATA_PROVIDER } from './provider.interface';
import { SyntheticProvider } from './synthetic.provider';

@Global()
@Module({
  providers: [
    SyntheticProvider,
    BrapiProvider,
    {
      provide: MARKET_DATA_PROVIDER,
      inject: [ConfigService, SyntheticProvider, BrapiProvider],
      useFactory: (config: ConfigService, synthetic: SyntheticProvider, brapi: BrapiProvider) =>
        config.get('MARKET_DATA_PROVIDER') === 'brapi' ? brapi : synthetic,
    },
    MarketDataService,
  ],
  exports: [MarketDataService],
})
export class MarketDataModule {}
