import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrapiProvider } from './brapi.provider';
import { MarketDataService } from './market-data.service';
import { MARKET_DATA_PROVIDER } from './provider.interface';
import { SyntheticProvider } from './synthetic.provider';
import { YahooProvider } from './yahoo.provider';

@Global()
@Module({
  providers: [
    SyntheticProvider,
    BrapiProvider,
    YahooProvider,
    {
      provide: MARKET_DATA_PROVIDER,
      inject: [ConfigService, SyntheticProvider, BrapiProvider, YahooProvider],
      useFactory: (
        config: ConfigService,
        synthetic: SyntheticProvider,
        brapi: BrapiProvider,
        yahoo: YahooProvider,
      ) => {
        // Selecao: env explicito vence; sem env, brapi se houver token pago;
        // caso contrario Yahoo (dados reais, gratuito, sem token).
        // Sintetico somente quando pedido explicitamente (dev offline).
        const mode = config.get<string>('MARKET_DATA_PROVIDER');
        const logger = new Logger('MarketData');
        if (mode === 'synthetic') {
          logger.log('Dados de mercado: sinteticos (demo)');
          return synthetic;
        }
        if (mode === 'brapi' || (!mode && config.get('BRAPI_TOKEN'))) {
          logger.log('Dados de mercado: brapi.dev (reais, requer plano)');
          return brapi;
        }
        logger.log('Dados de mercado: Yahoo Finance (reais)');
        return yahoo;
      },
    },
    MarketDataService,
  ],
  exports: [MarketDataService],
})
export class MarketDataModule {}
