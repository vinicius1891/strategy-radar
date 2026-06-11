// Teste manual do provider Yahoo Finance com tickers reais da B3.
// Executar: npx tsx scripts/test-yahoo.ts

import { evaluateStrategy } from '../src/core/rule-engine';
import { SYSTEM_STRATEGIES } from '../src/core/strategy-definitions';
import { YahooProvider } from '../src/modules/market-data/yahoo.provider';

async function main() {
  const provider = new YahooProvider();
  const tickers = ['BBDC4', 'PETR4', 'VALE3', 'WEGE3', 'MGLU3', 'BOVA11', 'ITUB4', 'PRIO3'];

  for (const t of tickers) {
    try {
      const [quote, candles] = await Promise.all([
        provider.getQuote(t),
        provider.getDailyCandles(t, 500),
      ]);
      const statuses = SYSTEM_STRATEGIES.map((d) => evaluateStrategy(candles, d.config).status);
      const active = statuses.filter((s) => s === 'ACTIVE').length;
      const arming = statuses.filter((s) => s === 'ARMING').length;
      console.log(
        `${t}: R$ ${quote.price} (${quote.changePct >= 0 ? '+' : ''}${quote.changePct}%) | ${candles.length} candles | ultimo close R$ ${candles[candles.length - 1].close} | radar: ${active} ativas, ${arming} armando`,
      );
    } catch (err) {
      console.error(`${t}: ERRO — ${(err as Error).message}`);
    }
  }
}

main();
