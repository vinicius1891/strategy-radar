'use client';

import Link from 'next/link';
import { fmtDateTime, fmtPct, fmtPrice } from '@/lib/format';
import { StrategyEvaluation } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

interface Props {
  evaluation: StrategyEvaluation;
  ticker: string;
  selected: boolean;
  onSelect: () => void;
}

export function StrategyCard({ evaluation: ev, ticker, selected, onSelect }: Props) {
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border bg-panel p-4 transition ${
        selected ? 'border-accent shadow-[0_0_0_1px_var(--color-accent)]' : 'border-edge hover:border-gray-500'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-white">{ev.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{ev.description}</p>
        </div>
        <StatusBadge status={ev.status} />
      </div>

      {ev.status === 'ACTIVE' && ev.levels && (
        <dl className="mt-3 grid grid-cols-4 gap-2 text-sm">
          <Metric label="Entrada" value={fmtPrice(ev.levels.entry)} />
          <Metric label="Stop" value={fmtPrice(ev.levels.stop)} tone="text-rose-400" />
          <Metric label="Alvo" value={fmtPrice(ev.levels.target)} tone="text-emerald-400" />
          <Metric label="Risco/Retorno" value={`1:${ev.levels.riskReward}`} />
        </dl>
      )}

      {ev.status === 'ARMING' && (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <Metric label="Gatilho" value={ev.trigger ? fmtPrice(ev.trigger.level) : '—'} />
          <Metric label="Preco Atual" value={ev.trigger ? fmtPrice(ev.trigger.currentPrice) : '—'} />
          <Metric
            label="Distancia"
            value={ev.trigger ? fmtPct(ev.trigger.distancePct) : '—'}
            tone="text-amber-400"
          />
        </dl>
      )}

      <ul className="mt-3 space-y-1">
        {ev.conditions.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-xs">
            <span className={c.passed ? 'text-emerald-400' : 'text-gray-600'}>
              {c.passed ? '●' : '○'}
            </span>
            <span className={c.passed ? 'text-gray-300' : 'text-gray-500'}>
              {c.label}
              {c.role === 'trigger' && <span className="ml-1 text-[10px] uppercase text-amber-500/70">gatilho</span>}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-edge pt-2 text-xs text-gray-500">
        <span>Atualizado {fmtDateTime(ev.evaluatedAt)}</span>
        <Link
          href={`/backtest?strategy=${ev.slug}&ticker=${ticker}&timeframe=${ev.timeframe}`}
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-accent hover:underline"
        >
          Backtest →
        </Link>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = 'text-gray-100' }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className={`font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}
