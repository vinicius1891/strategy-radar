'use client';

import {
  CandlestickData,
  createChart,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  LineStyle,
  Time,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import { Candle, StrategyEvaluation } from '@/lib/types';

interface Props {
  candles: Candle[];
  // Estrategia selecionada: zonas de entrada/stop/alvo/gatilho sobrepostas
  selected: StrategyEvaluation | null;
}

export function PriceChart({ candles, selected }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: '#9ca3af' },
      grid: {
        vertLines: { color: 'rgba(35, 48, 71, 0.5)' },
        horzLines: { color: 'rgba(35, 48, 71, 0.5)' },
      },
      rightPriceScale: { borderColor: '#233047' },
      timeScale: { borderColor: '#233047' },
      crosshair: { mode: 0 },
    });
    const series = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderUpColor: '#10b981',
      borderDownColor: '#f43f5e',
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLinesRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    const data: CandlestickData[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    for (const line of priceLinesRef.current) series.removePriceLine(line);
    priceLinesRef.current = [];
    if (!selected) return;

    const addLine = (price: number, color: string, title: string, style = LineStyle.Dashed) => {
      priceLinesRef.current.push(
        series.createPriceLine({ price, color, title, lineWidth: 1, lineStyle: style, axisLabelVisible: true }),
      );
    };

    if (selected.levels) {
      addLine(selected.levels.entry, '#38bdf8', 'Entrada', LineStyle.Solid);
      addLine(selected.levels.stop, '#f43f5e', 'Stop');
      addLine(selected.levels.target, '#10b981', 'Alvo');
    }
    if (selected.trigger) {
      addLine(selected.trigger.level, '#f59e0b', 'Gatilho');
    }
  }, [selected]);

  return <div ref={containerRef} className="h-[420px] w-full" />;
}
