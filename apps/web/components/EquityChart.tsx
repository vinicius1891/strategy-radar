'use client';

import { createChart, IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';
import { useEffect, useRef } from 'react';

export function EquityChart({ points }: { points: { time: number; value: number }[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

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
    });
    const series = chart.addAreaSeries({
      lineColor: '#38bdf8',
      topColor: 'rgba(56, 189, 248, 0.25)',
      bottomColor: 'rgba(56, 189, 248, 0.02)',
      lineWidth: 2,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    const data: LineData[] = points.map((p) => ({ time: p.time as Time, value: p.value }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [points]);

  return <div ref={containerRef} className="h-[280px] w-full" />;
}
