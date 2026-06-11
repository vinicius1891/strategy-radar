// Teste de sanidade do nucleo quantitativo (indicadores, motor de regras,
// backtest) sem dependencia de banco ou rede. Executar: npm run test:core

import { runBacktest } from '../src/core/backtest';
import { rsi, sma, ema, atr, bollinger } from '../src/core/indicators';
import { evaluateStrategy } from '../src/core/rule-engine';
import { SYSTEM_STRATEGIES } from '../src/core/strategy-definitions';
import { Candle } from '../src/core/types';
import { SyntheticProvider } from '../src/modules/market-data/synthetic.provider';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) console.log(`  ok    ${name}`);
  else {
    failures++;
    console.error(`  FALHA ${name} ${detail}`);
  }
}

function approx(a: number, b: number, tol = 1e-6) {
  return Math.abs(a - b) <= tol;
}

async function main() {
  console.log('== Indicadores ==');
  const closes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const s = sma(closes, 3);
  check('SMA(3) ultimo = 9', approx(s[9], 9));
  check('SMA(3) indice 2 = 2', approx(s[2], 2));
  check('SMA NaN antes do periodo', Number.isNaN(s[1]));

  const e = ema(closes, 3);
  check('EMA(3) definido apos warmup', !Number.isNaN(e[9]) && e[9] > 8 && e[9] < 10);

  // RSI de serie estritamente crescente deve ser 100
  const up = Array.from({ length: 30 }, (_, i) => 10 + i);
  const r = rsi(up, 14);
  check('RSI de alta continua = 100', approx(r[29], 100));

  // RSI de serie alternada deve ficar entre 0 e 100
  const zig = Array.from({ length: 60 }, (_, i) => 50 + (i % 2 === 0 ? 1 : -1) * 2);
  const rz = rsi(zig, 14);
  check('RSI alternado entre 30 e 70', rz[59] > 30 && rz[59] < 70);

  const candlesFlat: Candle[] = Array.from({ length: 30 }, (_, i) => ({
    time: i,
    open: 100,
    high: 102,
    low: 98,
    close: 100,
    volume: 1000,
  }));
  const a = atr(candlesFlat, 14);
  check('ATR de range constante = 4', approx(a[29], 4, 0.01));

  const bb = bollinger(Array(30).fill(50), 20, 2);
  check('Bollinger de serie constante colapsa na media', approx(bb.upper[29], 50) && approx(bb.lower[29], 50));

  console.log('== Provider sintetico ==');
  const provider = new SyntheticProvider();
  const candles = await provider.getDailyCandles('PETR4', 500);
  check('500 candles gerados', candles.length === 500);
  check(
    'OHLC consistente',
    candles.every((c) => c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close) && c.low > 0),
  );
  const again = await provider.getDailyCandles('PETR4', 500);
  check('Deterministico por ticker', JSON.stringify(candles) === JSON.stringify(again));

  console.log('== Motor de regras: 10 estrategias sobre dados sinteticos ==');
  const statuses = new Map<string, number>();
  for (const def of SYSTEM_STRATEGIES) {
    const evaluation = evaluateStrategy(candles, def.config);
    check(
      `${def.slug}: avaliacao valida (${evaluation.status})`,
      ['ACTIVE', 'ARMING', 'NO_SETUP', 'INVALIDATED'].includes(evaluation.status),
    );
    if (evaluation.status === 'ACTIVE') {
      check(
        `${def.slug}: niveis coerentes (stop < entrada < alvo)`,
        !!evaluation.levels &&
          evaluation.levels.stop < evaluation.levels.entry &&
          evaluation.levels.target > evaluation.levels.entry,
      );
    }
    statuses.set(evaluation.status, (statuses.get(evaluation.status) ?? 0) + 1);
  }
  console.log('  distribuicao:', Object.fromEntries(statuses));

  console.log('== Setup ativo construido manualmente ==');
  // Serie em alta com queda final forte => RSI baixo + preco acima da MM longa
  const engineered: Candle[] = [];
  let price = 10;
  for (let i = 0; i < 260; i++) {
    price *= 1.01;
    engineered.push({ time: i * 86400, open: price / 1.01, high: price * 1.005, low: (price / 1.01) * 0.995, close: price, volume: 1e6 });
  }
  for (let i = 0; i < 8; i++) {
    const open = price;
    price *= 0.985;
    engineered.push({ time: (260 + i) * 86400, open, high: open * 1.002, low: price * 0.998, close: price, volume: 1e6 });
  }
  const rsiDef = SYSTEM_STRATEGIES.find((d) => d.slug === 'rsi-reversal')!;
  const rsiEval = evaluateStrategy(engineered, rsiDef.config);
  check(`rsi-reversal em queda controlada vira ACTIVE/ARMING (${rsiEval.status})`, ['ACTIVE', 'ARMING'].includes(rsiEval.status));

  console.log('== Backtest ==');
  for (const def of SYSTEM_STRATEGIES) {
    const result = runBacktest(candles, def.config, { initialCapital: 10000 });
    const m = result.metrics;
    const tradesOk = result.trades.every(
      (t) => t.exitTime >= t.entryTime && Number.isFinite(t.pnl) && Number.isFinite(t.pnlPct),
    );
    const equityOk = result.equityCurve.length > 0 && result.equityCurve.every((p) => Number.isFinite(p.value));
    const capitalOk = approx(
      m.finalCapital,
      m.initialCapital + result.trades.reduce((sum, t) => sum + t.pnl, 0),
      0.05,
    );
    check(
      `${def.slug}: ${m.totalTrades} trades, retorno ${m.returnPct}%, dd ${m.maxDrawdownPct}%`,
      tradesOk && equityOk && capitalOk,
      capitalOk ? '' : `capital final inconsistente: ${m.finalCapital}`,
    );
  }

  console.log(failures === 0 ? '\nTodos os testes passaram.' : `\n${failures} falha(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
