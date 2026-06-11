import { SetupStatus } from '@/lib/types';

const STYLES: Record<SetupStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'Setup Detectado', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
  ARMING: { label: 'Armando', className: 'bg-amber-500/15 text-amber-400 border-amber-500/40' },
  NO_SETUP: { label: 'Sem Setup', className: 'bg-gray-500/15 text-gray-400 border-gray-500/40' },
  INVALIDATED: { label: 'Invalidado', className: 'bg-rose-500/15 text-rose-400 border-rose-500/40' },
};

export function StatusBadge({ status }: { status: SetupStatus }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}
