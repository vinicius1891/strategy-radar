// As 10 estrategias de sistema da V1, definidas exclusivamente como objetos
// de configuracao interpretados pelo motor de regras. Nenhuma possui codigo
// proprio; todos os parametros sao editaveis via campo `params`.

import { IndicatorName, Operand, StrategyDefinition } from './types';

const price = (field: 'open' | 'high' | 'low' | 'close' | 'volume', offset = 0): Operand => ({
  kind: 'price',
  field,
  ...(offset ? { offset } : {}),
});
const value = (v: number): Operand => ({ kind: 'value', value: v });
const param = (name: string): Operand => ({ kind: 'param', name });
const level = (name: 'entry' | 'stop'): Operand => ({ kind: 'level', name });
const indicator = (
  name: IndicatorName,
  params?: Record<string, number | { param: string }>,
  offset = 0,
): Operand => ({ kind: 'indicator', name, ...(params ? { params } : {}), ...(offset ? { offset } : {}) });
const expr = (op: '+' | '-' | '*' | '/', left: Operand, right: Operand): Operand => ({
  kind: 'expr',
  op,
  left,
  right,
});

const p = (name: string) => ({ param: name });

// Alvo em multiplos do risco: entry + mult * (entry - stop)
const riskMultipleTarget = (multParam: string): Operand =>
  expr('+', level('entry'), expr('*', param(multParam), expr('-', level('entry'), level('stop'))));

export const SYSTEM_STRATEGIES: StrategyDefinition[] = [
  {
    slug: 'rsi-reversal',
    name: 'RSI Reversal',
    description:
      'Busca exaustao de baixa em tendencia de alta: RSI em zona de sobrevenda com preco acima da media longa.',
    timeframes: ['1d', '1wk'],
    config: {
      direction: 'long',
      warmup: 210,
      params: { rsiPeriod: 14, oversold: 30, trendPeriod: 200, atrPeriod: 14, stopAtrMult: 1.5, targetRR: 2 },
      indicatorsUsed: ['RSI', 'SMA', 'ATR'],
      entry: {
        kind: 'group',
        logic: 'AND',
        conditions: [
          {
            kind: 'compare',
            op: '>',
            left: price('close'),
            right: indicator('SMA', { period: p('trendPeriod') }),
            label: 'Preco acima da MM longa',
            role: 'filter',
          },
          {
            kind: 'compare',
            op: '<',
            left: indicator('RSI', { period: p('rsiPeriod') }),
            right: param('oversold'),
            label: 'RSI abaixo da zona de sobrevenda',
            role: 'trigger',
          },
        ],
      },
      invalidation: {
        kind: 'compare',
        op: '<',
        left: price('close'),
        right: expr('*', indicator('SMA', { period: p('trendPeriod') }), value(0.97)),
        label: 'Preco perdeu a MM longa com folga',
      },
      levels: {
        entry: price('close'),
        stop: expr('-', price('close'), expr('*', param('stopAtrMult'), indicator('ATR', { period: p('atrPeriod') }))),
        target: riskMultipleTarget('targetRR'),
      },
    },
  },
  {
    slug: 'pullback-mm21',
    name: 'Pullback MM21',
    description:
      'Correcao ate a MM21 em tendencia de alta; gatilho no rompimento da maxima do candle anterior.',
    timeframes: ['1d'],
    config: {
      direction: 'long',
      warmup: 60,
      params: { emaPeriod: 21, slopeLookback: 3, stopLookback: 5, targetRR: 3 },
      indicatorsUsed: ['EMA', 'LOWEST_LOW'],
      entry: {
        kind: 'group',
        logic: 'AND',
        conditions: [
          {
            kind: 'compare',
            op: '>',
            left: indicator('EMA', { period: p('emaPeriod') }),
            right: indicator('EMA', { period: p('emaPeriod') }, 3),
            label: 'MM21 ascendente',
            role: 'filter',
          },
          {
            kind: 'compare',
            op: '<=',
            left: price('low'),
            right: expr('*', indicator('EMA', { period: p('emaPeriod') }), value(1.01)),
            label: 'Preco testou a MM21',
            role: 'filter',
          },
          {
            kind: 'compare',
            op: '>',
            left: price('close'),
            right: price('high', 1),
            label: 'Rompeu a maxima do candle anterior',
            role: 'trigger',
          },
        ],
      },
      invalidation: {
        kind: 'compare',
        op: '<',
        left: price('close'),
        right: expr('*', indicator('EMA', { period: p('emaPeriod') }), value(0.97)),
        label: 'Fechou bem abaixo da MM21',
      },
      levels: {
        entry: price('close'),
        stop: indicator('LOWEST_LOW', { period: p('stopLookback') }),
        target: riskMultipleTarget('targetRR'),
        trigger: price('high', 1),
      },
    },
  },
  {
    slug: 'breakout-20',
    name: 'Rompimento 20 Periodos',
    description: 'Fechamento acima da maxima dos ultimos 20 candles com volume acima da media.',
    timeframes: ['1d', '1wk'],
    config: {
      direction: 'long',
      warmup: 40,
      params: { lookback: 20, volPeriod: 20, atrPeriod: 14, stopAtrMult: 2, targetRR: 2 },
      indicatorsUsed: ['HIGHEST_HIGH', 'VOLUME_SMA', 'ATR'],
      entry: {
        kind: 'group',
        logic: 'AND',
        conditions: [
          {
            kind: 'compare',
            op: '>',
            left: price('volume'),
            right: indicator('VOLUME_SMA', { period: p('volPeriod') }),
            label: 'Volume acima da media',
            role: 'filter',
          },
          {
            kind: 'compare',
            op: '>',
            left: price('close'),
            right: indicator('HIGHEST_HIGH', { period: p('lookback') }, 1),
            label: 'Fechou acima da maxima de 20 periodos',
            role: 'trigger',
          },
        ],
      },
      levels: {
        entry: price('close'),
        stop: expr('-', price('close'), expr('*', param('stopAtrMult'), indicator('ATR', { period: p('atrPeriod') }))),
        target: riskMultipleTarget('targetRR'),
        trigger: indicator('HIGHEST_HIGH', { period: p('lookback') }, 1),
      },
    },
  },
  {
    slug: 'macd-trend',
    name: 'MACD Trend',
    description: 'Cruzamento do MACD acima da linha de sinal com preco acima da media longa.',
    timeframes: ['1d', '1wk'],
    config: {
      direction: 'long',
      warmup: 210,
      params: { fast: 12, slow: 26, signal: 9, trendPeriod: 200, stopLookback: 10, targetRR: 2 },
      indicatorsUsed: ['MACD', 'SMA', 'LOWEST_LOW'],
      entry: {
        kind: 'group',
        logic: 'AND',
        conditions: [
          {
            kind: 'compare',
            op: '>',
            left: price('close'),
            right: indicator('SMA', { period: p('trendPeriod') }),
            label: 'Preco acima da MM longa',
            role: 'filter',
          },
          {
            kind: 'cross',
            direction: 'above',
            left: indicator('MACD', { fast: p('fast'), slow: p('slow'), signal: p('signal') }),
            right: indicator('MACD_SIGNAL', { fast: p('fast'), slow: p('slow'), signal: p('signal') }),
            label: 'MACD cruzou acima do sinal',
            role: 'trigger',
          },
        ],
      },
      exit: {
        kind: 'cross',
        direction: 'below',
        left: indicator('MACD', { fast: p('fast'), slow: p('slow'), signal: p('signal') }),
        right: indicator('MACD_SIGNAL', { fast: p('fast'), slow: p('slow'), signal: p('signal') }),
        label: 'MACD cruzou abaixo do sinal',
      },
      levels: {
        entry: price('close'),
        stop: indicator('LOWEST_LOW', { period: p('stopLookback') }),
        target: riskMultipleTarget('targetRR'),
      },
    },
  },
  {
    slug: 'donchian-breakout',
    name: 'Donchian Breakout',
    description: 'Rompimento do canal de Donchian de 20 periodos com forca de tendencia (ADX).',
    timeframes: ['1d', '1wk'],
    config: {
      direction: 'long',
      warmup: 60,
      params: { channelPeriod: 20, exitPeriod: 10, adxPeriod: 14, adxMin: 20, atrPeriod: 14, stopAtrMult: 2, targetRR: 3 },
      indicatorsUsed: ['DONCHIAN_UPPER', 'DONCHIAN_LOWER', 'ADX', 'ATR'],
      entry: {
        kind: 'group',
        logic: 'AND',
        conditions: [
          {
            kind: 'compare',
            op: '>',
            left: indicator('ADX', { period: p('adxPeriod') }),
            right: param('adxMin'),
            label: 'ADX indica tendencia',
            role: 'filter',
          },
          {
            kind: 'compare',
            op: '>',
            left: price('close'),
            right: indicator('DONCHIAN_UPPER', { period: p('channelPeriod') }, 1),
            label: 'Fechou acima do canal superior',
            role: 'trigger',
          },
        ],
      },
      exit: {
        kind: 'compare',
        op: '<',
        left: price('close'),
        right: indicator('DONCHIAN_LOWER', { period: p('exitPeriod') }, 1),
        label: 'Fechou abaixo do canal inferior curto',
      },
      levels: {
        entry: price('close'),
        stop: expr('-', price('close'), expr('*', param('stopAtrMult'), indicator('ATR', { period: p('atrPeriod') }))),
        target: riskMultipleTarget('targetRR'),
        trigger: indicator('DONCHIAN_UPPER', { period: p('channelPeriod') }, 1),
      },
    },
  },
  {
    slug: 'adx-trend',
    name: 'ADX Trend',
    description: 'Tendencia forte (ADX) com dominancia compradora (+DI > -DI) e rompimento curto.',
    timeframes: ['1d'],
    config: {
      direction: 'long',
      warmup: 60,
      params: { adxPeriod: 14, adxMin: 25, lookback: 10, stopLookback: 7, targetRR: 2.5 },
      indicatorsUsed: ['ADX', 'PLUS_DI', 'MINUS_DI', 'HIGHEST_HIGH', 'LOWEST_LOW'],
      entry: {
        kind: 'group',
        logic: 'AND',
        conditions: [
          {
            kind: 'compare',
            op: '>',
            left: indicator('ADX', { period: p('adxPeriod') }),
            right: param('adxMin'),
            label: 'ADX acima do minimo',
            role: 'filter',
          },
          {
            kind: 'compare',
            op: '>',
            left: indicator('PLUS_DI', { period: p('adxPeriod') }),
            right: indicator('MINUS_DI', { period: p('adxPeriod') }),
            label: '+DI acima de -DI',
            role: 'filter',
          },
          {
            kind: 'compare',
            op: '>',
            left: price('close'),
            right: indicator('HIGHEST_HIGH', { period: p('lookback') }, 1),
            label: 'Rompeu a maxima curta',
            role: 'trigger',
          },
        ],
      },
      invalidation: {
        kind: 'compare',
        op: '<',
        left: indicator('PLUS_DI', { period: p('adxPeriod') }),
        right: indicator('MINUS_DI', { period: p('adxPeriod') }),
        label: 'Dominancia vendedora (-DI acima)',
      },
      levels: {
        entry: price('close'),
        stop: indicator('LOWEST_LOW', { period: p('stopLookback') }),
        target: riskMultipleTarget('targetRR'),
        trigger: indicator('HIGHEST_HIGH', { period: p('lookback') }, 1),
      },
    },
  },
  {
    slug: 'atr-breakout',
    name: 'ATR Breakout',
    description: 'Expansao de volatilidade: fechamento acima do fechamento anterior somado a 1.5x ATR.',
    timeframes: ['1d'],
    config: {
      direction: 'long',
      warmup: 40,
      params: { atrPeriod: 14, breakoutMult: 1.5, stopAtrMult: 1.5, targetRR: 2 },
      indicatorsUsed: ['ATR'],
      entry: {
        kind: 'compare',
        op: '>',
        left: price('close'),
        right: expr(
          '+',
          price('close', 1),
          expr('*', param('breakoutMult'), indicator('ATR', { period: p('atrPeriod') }, 1)),
        ),
        label: 'Fechamento rompeu 1.5x ATR acima do anterior',
        role: 'trigger',
      },
      levels: {
        entry: price('close'),
        stop: expr('-', price('close'), expr('*', param('stopAtrMult'), indicator('ATR', { period: p('atrPeriod') }))),
        target: riskMultipleTarget('targetRR'),
        trigger: expr(
          '+',
          price('close', 1),
          expr('*', param('breakoutMult'), indicator('ATR', { period: p('atrPeriod') }, 1)),
        ),
      },
    },
  },
  {
    slug: 'bollinger-reversal',
    name: 'Bollinger Reversal',
    description: 'Toque na banda inferior seguido de fechamento de volta para dentro das bandas.',
    timeframes: ['1d'],
    config: {
      direction: 'long',
      warmup: 40,
      params: { bbPeriod: 20, bbMult: 2, stopLookback: 5, targetRR: 1.5 },
      indicatorsUsed: ['BB_LOWER', 'BB_MIDDLE', 'LOWEST_LOW'],
      entry: {
        kind: 'group',
        logic: 'AND',
        conditions: [
          {
            kind: 'compare',
            op: '<=',
            left: price('low'),
            right: indicator('BB_LOWER', { period: p('bbPeriod'), mult: p('bbMult') }),
            label: 'Minima tocou a banda inferior',
            role: 'filter',
          },
          {
            kind: 'compare',
            op: '>',
            left: price('close'),
            right: indicator('BB_LOWER', { period: p('bbPeriod'), mult: p('bbMult') }),
            label: 'Fechou de volta dentro das bandas',
            role: 'trigger',
          },
        ],
      },
      exit: {
        kind: 'compare',
        op: '>=',
        left: price('close'),
        right: indicator('BB_MIDDLE', { period: p('bbPeriod'), mult: p('bbMult') }),
        label: 'Alcancou a banda central',
      },
      levels: {
        entry: price('close'),
        stop: indicator('LOWEST_LOW', { period: p('stopLookback') }),
        target: riskMultipleTarget('targetRR'),
        trigger: indicator('BB_LOWER', { period: p('bbPeriod'), mult: p('bbMult') }),
      },
    },
  },
  {
    slug: 'volume-breakout',
    name: 'Volume Breakout',
    description: 'Rompimento de maxima curta acompanhado de volume ao menos 2x acima da media.',
    timeframes: ['1d'],
    config: {
      direction: 'long',
      warmup: 40,
      params: { lookback: 10, volPeriod: 20, volMult: 2, atrPeriod: 14, stopAtrMult: 2, targetRR: 2 },
      indicatorsUsed: ['HIGHEST_HIGH', 'VOLUME_SMA', 'ATR'],
      entry: {
        kind: 'group',
        logic: 'AND',
        conditions: [
          {
            kind: 'compare',
            op: '>',
            left: price('volume'),
            right: expr('*', param('volMult'), indicator('VOLUME_SMA', { period: p('volPeriod') })),
            label: 'Volume 2x acima da media',
            role: 'filter',
          },
          {
            kind: 'compare',
            op: '>',
            left: price('close'),
            right: indicator('HIGHEST_HIGH', { period: p('lookback') }, 1),
            label: 'Rompeu a maxima curta',
            role: 'trigger',
          },
        ],
      },
      levels: {
        entry: price('close'),
        stop: expr('-', price('close'), expr('*', param('stopAtrMult'), indicator('ATR', { period: p('atrPeriod') }))),
        target: riskMultipleTarget('targetRR'),
        trigger: indicator('HIGHEST_HIGH', { period: p('lookback') }, 1),
      },
    },
  },
  {
    slug: 'mm9-mm21-cross',
    name: 'MM9/MM21 Cross',
    description: 'Cruzamento da media curta (9) acima da media intermediaria (21) em contexto de alta.',
    timeframes: ['1d', '1wk'],
    config: {
      direction: 'long',
      warmup: 90,
      params: { fastPeriod: 9, slowPeriod: 21, trendPeriod: 80, stopLookback: 10, targetRR: 2.5 },
      indicatorsUsed: ['EMA', 'LOWEST_LOW'],
      entry: {
        kind: 'group',
        logic: 'AND',
        conditions: [
          {
            kind: 'compare',
            op: '>',
            left: price('close'),
            right: indicator('SMA', { period: p('trendPeriod') }),
            label: 'Preco acima da media de contexto',
            role: 'filter',
          },
          {
            kind: 'cross',
            direction: 'above',
            left: indicator('EMA', { period: p('fastPeriod') }),
            right: indicator('EMA', { period: p('slowPeriod') }),
            label: 'MM9 cruzou acima da MM21',
            role: 'trigger',
          },
        ],
      },
      exit: {
        kind: 'cross',
        direction: 'below',
        left: indicator('EMA', { period: p('fastPeriod') }),
        right: indicator('EMA', { period: p('slowPeriod') }),
        label: 'MM9 cruzou abaixo da MM21',
      },
      levels: {
        entry: price('close'),
        stop: indicator('LOWEST_LOW', { period: p('stopLookback') }),
        target: riskMultipleTarget('targetRR'),
      },
    },
  },
];

export const SEED_ASSETS = [
  { ticker: 'PETR4', name: 'Petrobras PN', exchange: 'B3', type: 'stock', currency: 'BRL' },
  { ticker: 'VALE3', name: 'Vale ON', exchange: 'B3', type: 'stock', currency: 'BRL' },
  { ticker: 'ITUB4', name: 'Itau Unibanco PN', exchange: 'B3', type: 'stock', currency: 'BRL' },
  { ticker: 'BBDC4', name: 'Bradesco PN', exchange: 'B3', type: 'stock', currency: 'BRL' },
  { ticker: 'ABEV3', name: 'Ambev ON', exchange: 'B3', type: 'stock', currency: 'BRL' },
  { ticker: 'WEGE3', name: 'WEG ON', exchange: 'B3', type: 'stock', currency: 'BRL' },
  { ticker: 'MGLU3', name: 'Magazine Luiza ON', exchange: 'B3', type: 'stock', currency: 'BRL' },
  { ticker: 'B3SA3', name: 'B3 ON', exchange: 'B3', type: 'stock', currency: 'BRL' },
  { ticker: 'BOVA11', name: 'iShares Ibovespa', exchange: 'B3', type: 'etf', currency: 'BRL' },
  { ticker: 'PRIO3', name: 'PRIO ON', exchange: 'B3', type: 'stock', currency: 'BRL' },
];
