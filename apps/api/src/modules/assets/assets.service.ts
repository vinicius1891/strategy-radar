import { Inject, Injectable } from '@nestjs/common';
import { Timeframe } from '../../core/types';
import { MarketDataService } from '../market-data/market-data.service';
import { ASSETS_REPOSITORY, AssetsRepository } from '../persistence/repositories';

@Injectable()
export class AssetsService {
  constructor(
    @Inject(ASSETS_REPOSITORY) private readonly assets: AssetsRepository,
    private readonly marketData: MarketDataService,
  ) {}

  search(query: string) {
    return this.assets.search(query);
  }

  // Cotacao + cadastro sob demanda do ativo na primeira consulta
  async getOverview(ticker: string) {
    const quote = await this.marketData.getQuote(ticker);
    const asset = await this.assets.ensure(quote.ticker, quote.name);
    return { asset, quote };
  }

  getCandles(ticker: string, timeframe: Timeframe, rangeDays: number) {
    return this.marketData.getCandles(ticker, timeframe, rangeDays);
  }
}
