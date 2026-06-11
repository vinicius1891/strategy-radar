// Indicadores tecnicos calculados sobre series completas de candles.
// Todas as funcoes retornam arrays alinhados ao array de candles,
// preenchendo NaN nos indices em que o indicador ainda nao esta definido.

import { Candle } from './types';

const nanArray = (n: number) => new Array<number>(n).fill(NaN);

export function sma(values: number[], period: number): number[] {
  const out = nanArray(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out = nanArray(values.length);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  out[period - 1] = seed / period;
  for (let i = period; i < values.length; i++) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

// RSI de Wilder
export function rsi(closes: number[], period: number): number[] {
  const out = nanArray(closes.length);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function macd(
  closes: number[],
  fast: number,
  slow: number,
  signal: number,
): { line: number[]; signal: number[]; hist: number[] } {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const line = closes.map((_, i) => fastEma[i] - slowEma[i]);
  // EMA do MACD ignorando o trecho NaN inicial
  const firstValid = line.findIndex((v) => !Number.isNaN(v));
  const sig = nanArray(closes.length);
  if (firstValid >= 0) {
    const valid = line.slice(firstValid);
    const sigValid = ema(valid, signal);
    for (let i = 0; i < sigValid.length; i++) sig[firstValid + i] = sigValid[i];
  }
  const hist = line.map((v, i) => v - sig[i]);
  return { line, signal: sig, hist };
}

function trueRanges(candles: Candle[]): number[] {
  return candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
  });
}

// Suavizacao de Wilder (RMA)
function wilderSmooth(values: number[], period: number): number[] {
  const out = nanArray(values.length);
  if (values.length < period) return out;
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  out[period - 1] = seed / period;
  for (let i = period; i < values.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + values[i]) / period;
  }
  return out;
}

export function atr(candles: Candle[], period: number): number[] {
  return wilderSmooth(trueRanges(candles), period);
}

export function dmi(
  candles: Candle[],
  period: number,
): { adx: number[]; plusDi: number[]; minusDi: number[] } {
  const n = candles.length;
  const plusDm = nanArray(n);
  const minusDm = nanArray(n);
  plusDm[0] = 0;
  minusDm[0] = 0;
  for (let i = 1; i < n; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDm[i] = up > down && up > 0 ? up : 0;
    minusDm[i] = down > up && down > 0 ? down : 0;
  }
  const trSmooth = wilderSmooth(trueRanges(candles), period);
  const plusSmooth = wilderSmooth(plusDm, period);
  const minusSmooth = wilderSmooth(minusDm, period);
  const plusDi = nanArray(n);
  const minusDi = nanArray(n);
  const dx = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(trSmooth[i]) || trSmooth[i] === 0) continue;
    plusDi[i] = (100 * plusSmooth[i]) / trSmooth[i];
    minusDi[i] = (100 * minusSmooth[i]) / trSmooth[i];
    const sum = plusDi[i] + minusDi[i];
    dx[i] = sum === 0 ? 0 : (100 * Math.abs(plusDi[i] - minusDi[i])) / sum;
  }
  // ADX = media de Wilder do DX a partir do primeiro DX valido
  const adxOut = nanArray(n);
  const firstValid = dx.findIndex((v) => !Number.isNaN(v));
  if (firstValid >= 0) {
    const valid = dx.slice(firstValid);
    const smoothed = wilderSmooth(valid, period);
    for (let i = 0; i < smoothed.length; i++) adxOut[firstValid + i] = smoothed[i];
  }
  return { adx: adxOut, plusDi, minusDi };
}

export function bollinger(
  closes: number[],
  period: number,
  mult: number,
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(closes, period);
  const upper = nanArray(closes.length);
  const lower = nanArray(closes.length);
  for (let i = period - 1; i < closes.length; i++) {
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      variance += (closes[j] - middle[i]) ** 2;
    }
    const sd = Math.sqrt(variance / period);
    upper[i] = middle[i] + mult * sd;
    lower[i] = middle[i] - mult * sd;
  }
  return { upper, middle, lower };
}

export function highest(values: number[], period: number): number[] {
  const out = nanArray(values.length);
  for (let i = period - 1; i < values.length; i++) {
    let max = -Infinity;
    for (let j = i - period + 1; j <= i; j++) max = Math.max(max, values[j]);
    out[i] = max;
  }
  return out;
}

export function lowest(values: number[], period: number): number[] {
  const out = nanArray(values.length);
  for (let i = period - 1; i < values.length; i++) {
    let min = Infinity;
    for (let j = i - period + 1; j <= i; j++) min = Math.min(min, values[j]);
    out[i] = min;
  }
  return out;
}

export function donchian(
  candles: Candle[],
  period: number,
): { upper: number[]; middle: number[]; lower: number[] } {
  const upper = highest(candles.map((c) => c.high), period);
  const lower = lowest(candles.map((c) => c.low), period);
  const middle = upper.map((u, i) => (u + lower[i]) / 2);
  return { upper, middle, lower };
}
