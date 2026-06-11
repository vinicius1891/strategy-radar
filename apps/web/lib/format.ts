export const fmtPrice = (v: number | null | undefined, currency = 'BRL') =>
  v == null
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(v);

export const fmtNumber = (v: number | null | undefined, digits = 2) =>
  v == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(v);

export const fmtPct = (v: number | null | undefined, digits = 2) =>
  v == null ? '—' : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v)}%`;

export const fmtVolume = (v: number | null | undefined) => {
  if (v == null) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
};

export const fmtDate = (epochSeconds: number) =>
  new Date(epochSeconds * 1000).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR');
