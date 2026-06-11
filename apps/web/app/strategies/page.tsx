'use client';

import { useQuery } from '@tanstack/react-query';
import { AuthGuard } from '@/components/AuthGuard';
import { Header } from '@/components/Header';
import { api } from '@/lib/api';
import { StrategyRecord } from '@/lib/types';

export default function StrategiesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => api<StrategyRecord[]>('/strategies'),
  });

  return (
    <AuthGuard>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-xl font-bold text-white">Estrategias cadastradas</h1>
        <p className="mt-1 text-sm text-gray-400">
          Estrategias sao objetos configuraveis interpretados pelo motor de regras. Parametros podem
          ser ajustados via API sem alterar codigo.
        </p>

        {isLoading && <p className="py-20 text-center text-gray-500">Carregando…</p>}

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {(data ?? []).map((s) => (
            <div key={s.id} className="rounded-xl border border-edge bg-panel p-4">
              <div className="flex items-start justify-between">
                <h2 className="font-semibold text-white">{s.name}</h2>
                <span className="rounded-full border border-edge px-2 py-0.5 text-[10px] uppercase text-gray-400">
                  {s.timeframes.join(' · ')}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-400">{s.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.config.indicatorsUsed.map((ind) => (
                  <span key={ind} className="rounded bg-panel-2 px-2 py-0.5 text-[11px] text-accent">
                    {ind}
                  </span>
                ))}
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                {Object.entries(s.config.params).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-gray-500">{k}</dt>
                    <dd className="font-mono text-gray-300">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </main>
    </AuthGuard>
  );
}
