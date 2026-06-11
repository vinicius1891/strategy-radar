'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { EquityChart } from '@/components/EquityChart';
import { Header } from '@/components/Header';
import { api } from '@/lib/api';
import { fmtDate, fmtNumber, fmtPct, fmtPrice } from '@/lib/format';
import { BacktestResponse, Timeframe } from '@/lib/types';

const EXIT_LABEL: Record<string, string> = {
  stop: 'Stop',
  target: 'Alvo',
  exit_rule: 'Regra de saida',
  time: 'Tempo maximo',
  end_of_data: 'Fim da serie',
};

function BacktestContent() {
  const search = useSearchParams();
  const strategy = search.get('strategy') ?? '';
  const ticker = (search.get('ticker') ?? '').toUpperCase();
  const timeframe = (search.get('timeframe') === '1wk' ? '1wk' : '1d') as Timeframe;
  const [rangeDays, setRangeDays] = useState(timeframe === '1wk' ? 1825 : 730);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['backtest', strategy, ticker, timeframe, rangeDays],
    queryFn: () =>
      api<BacktestResponse>('/backtest', {
        method: 'POST',
        body: JSON.stringify({ strategy, ticker, timeframe, rangeDays, initialCapital: 10000 }),
      }),
    enabled: Boolean(strategy && ticker),
  });

  if (!strategy || !ticker) {
    return <p className="py-20 text-center text-gray-500">Selecione uma estrategia a partir do radar de um ativo.</p>;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white">
          Backtest — {data?.strategy.name ?? strategy} <span className="text-gray-400">em</span> {ticker}{' '}
          <span className="text-sm font-normal text-gray-400">({timeframe === '1d' ? 'diario' : 'semanal'})</span>
        </h1>
        <select
          value={rangeDays}
          onChange={(e) => setRangeDays(Number(e.target.value))}
          className="rounded-lg border border-edge bg-panel-2 px-3 py-1.5 text-sm text-gray-200 outline-none"
        >
          <option value={365}>1 ano</option>
          <option value={730}>2 anos</option>
          <option value={1825}>5 anos</option>
        </select>
      </div>

      {isLoading && <p className="py-20 text-center text-gray-500">Executando backtest…</p>}
      {isError && <p className="py-20 text-center text-rose-400">Falha ao executar o backtest.</p>}

      {data && (
        <>
          <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
            <Stat label="Capital Inicial" value={fmtPrice(data.metrics.initialCapital)} />
            <Stat label="Capital Final" value={fmtPrice(data.metrics.finalCapital)} />
            <Stat
              label="Lucro Liquido"
              value={fmtPrice(data.metrics.netProfit)}
              tone={data.metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}
            />
            <Stat
              label="Retorno"
              value={fmtPct(data.metrics.returnPct)}
              tone={data.metrics.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}
            />
            <Stat label="Win Rate" value={fmtPct(data.metrics.winRate)} />
            <Stat label="Profit Factor" value={fmtNumber(data.metrics.profitFactor)} />
            <Stat label="Expectancy" value={fmtPct(data.metrics.expectancyPct)} />
            <Stat label="Drawdown Max" value={fmtPct(data.metrics.maxDrawdownPct)} tone="text-rose-400" />
          </section>

          <section className="mt-4 rounded-2xl border border-edge bg-panel p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Curva de Capital ({data.metrics.totalTrades} operacoes)
            </h2>
            {data.equityCurve.length > 0 ? (
              <EquityChart points={data.equityCurve} />
            ) : (
              <p className="py-10 text-center text-gray-500">Sem dados suficientes.</p>
            )}
          </section>

          <section className="mt-4 rounded-2xl border border-edge bg-panel p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Operacoes ({data.trades.length})
            </h2>
            {data.trades.length === 0 ? (
              <p className="py-6 text-center text-gray-500">
                Nenhuma condicao de entrada encontrada no periodo analisado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-edge text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="py-2 pr-4">Entrada</th>
                      <th className="py-2 pr-4">Saida</th>
                      <th className="py-2 pr-4">Preco Entrada</th>
                      <th className="py-2 pr-4">Preco Saida</th>
                      <th className="py-2 pr-4">Resultado</th>
                      <th className="py-2 pr-4">%</th>
                      <th className="py-2 pr-4">Candles</th>
                      <th className="py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trades.map((t, i) => (
                      <tr key={i} className="border-b border-edge/50">
                        <td className="py-2 pr-4 text-gray-300">{fmtDate(t.entryTime)}</td>
                        <td className="py-2 pr-4 text-gray-300">{fmtDate(t.exitTime)}</td>
                        <td className="py-2 pr-4">{fmtPrice(t.entryPrice)}</td>
                        <td className="py-2 pr-4">{fmtPrice(t.exitPrice)}</td>
                        <td className={`py-2 pr-4 font-medium ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {fmtPrice(t.pnl)}
                        </td>
                        <td className={`py-2 pr-4 ${t.pnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {fmtPct(t.pnlPct)}
                        </td>
                        <td className="py-2 pr-4 text-gray-400">{t.bars}</td>
                        <td className="py-2 text-gray-400">{EXIT_LABEL[t.exitReason]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${tone}`}>{value}</div>
    </div>
  );
}

export default function BacktestPage() {
  return (
    <AuthGuard>
      <Header />
      <Suspense fallback={<p className="py-20 text-center text-gray-500">Carregando…</p>}>
        <BacktestContent />
      </Suspense>
    </AuthGuard>
  );
}
