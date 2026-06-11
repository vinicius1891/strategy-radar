'use client';

import { useQuery } from '@tanstack/react-query';
import { use, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { Header } from '@/components/Header';
import { PriceChart } from '@/components/PriceChart';
import { StrategyCard } from '@/components/StrategyCard';
import { api } from '@/lib/api';
import { fmtPct, fmtPrice, fmtVolume } from '@/lib/format';
import { Candle, RadarResponse, Timeframe } from '@/lib/types';

export default function AssetPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = use(params);
  const ticker = decodeURIComponent(rawTicker).toUpperCase();
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const radar = useQuery({
    queryKey: ['radar', ticker, timeframe],
    queryFn: () => api<RadarResponse>(`/radar/${ticker}?timeframe=${timeframe}`),
    refetchInterval: 60_000,
  });

  const candles = useQuery({
    queryKey: ['candles', ticker, timeframe],
    queryFn: () => api<Candle[]>(`/assets/${ticker}/candles?timeframe=${timeframe}&range=420`),
  });

  const data = radar.data;
  const selected = data?.strategies.find((s) => s.slug === selectedSlug) ?? null;
  const counts = data
    ? {
        active: data.strategies.filter((s) => s.status === 'ACTIVE').length,
        arming: data.strategies.filter((s) => s.status === 'ARMING').length,
      }
    : null;

  return (
    <AuthGuard>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        {radar.isLoading && <p className="py-20 text-center text-gray-500">Analisando {ticker}…</p>}
        {radar.isError && (
          <p className="py-20 text-center text-rose-400">
            Nao foi possivel analisar {ticker}. Verifique o ticker e tente novamente.
          </p>
        )}

        {data && (
          <>
            <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-edge bg-panel p-5">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-white">{data.asset.ticker}</h1>
                  <span className="text-sm text-gray-400">{data.asset.name}</span>
                </div>
                <div className="mt-2 flex items-baseline gap-4">
                  <span className="text-3xl font-bold text-white">
                    {fmtPrice(data.quote.price, data.quote.currency)}
                  </span>
                  <span
                    className={`font-semibold ${data.quote.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                  >
                    {data.quote.changePct >= 0 ? '+' : ''}
                    {fmtPct(data.quote.changePct)}
                  </span>
                  <span className="text-sm text-gray-400">Vol {fmtVolume(data.quote.volume)}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {counts && (
                  <div className="text-right text-sm">
                    <div className="text-emerald-400">{counts.active} setup(s) detectado(s)</div>
                    <div className="text-amber-400">{counts.arming} armando</div>
                  </div>
                )}
                <div className="flex overflow-hidden rounded-lg border border-edge">
                  {(['1d', '1wk'] as Timeframe[]).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => {
                        setTimeframe(tf);
                        setSelectedSlug(null);
                      }}
                      className={`px-3 py-1.5 text-sm font-medium ${
                        timeframe === tf ? 'bg-accent text-gray-950' : 'bg-panel-2 text-gray-300 hover:text-white'
                      }`}
                    >
                      {tf === '1d' ? 'Diario' : 'Semanal'}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-edge bg-panel p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Grafico</h2>
                {selected && (
                  <span className="text-xs text-gray-400">
                    Niveis em destaque: <span className="text-white">{selected.name}</span>{' '}
                    <button onClick={() => setSelectedSlug(null)} className="ml-2 text-accent hover:underline">
                      limpar
                    </button>
                  </span>
                )}
              </div>
              {candles.data ? (
                <PriceChart candles={candles.data} selected={selected} />
              ) : (
                <div className="flex h-[420px] items-center justify-center text-gray-500">Carregando grafico…</div>
              )}
            </section>

            <section className="mt-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                Estrategias analisadas ({data.strategies.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {data.strategies.map((ev) => (
                  <StrategyCard
                    key={ev.slug}
                    evaluation={ev}
                    ticker={ticker}
                    selected={selectedSlug === ev.slug}
                    onSelect={() => setSelectedSlug(selectedSlug === ev.slug ? null : ev.slug)}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </AuthGuard>
  );
}
