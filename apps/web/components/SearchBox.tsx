'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Asset } from '@/lib/types';

export function SearchBox({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const { data: results } = useQuery({
    queryKey: ['asset-search', query],
    queryFn: () => api<Asset[]>(`/assets/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length >= 2,
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (ticker: string) => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setOpen(false);
    setQuery('');
    router.push(`/asset/${t}`);
  };

  return (
    <div ref={boxRef} className={`relative ${compact ? 'max-w-md' : 'w-full'}`}>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => e.key === 'Enter' && go(query)}
        placeholder="Pesquisar ativo (ex.: PETR4)"
        className={`w-full rounded-lg border border-edge bg-panel-2 px-4 text-gray-100 placeholder-gray-500 outline-none transition focus:border-accent ${
          compact ? 'py-1.5 text-sm' : 'py-3 text-lg'
        }`}
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-edge bg-panel shadow-xl">
          {(results ?? []).map((a) => (
            <button
              key={a.id}
              onClick={() => go(a.ticker)}
              className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-panel-2"
            >
              <span className="font-semibold text-white">{a.ticker}</span>
              <span className="text-sm text-gray-400">{a.name}</span>
            </button>
          ))}
          <button
            onClick={() => go(query)}
            className="w-full border-t border-edge px-4 py-2 text-left text-sm text-accent hover:bg-panel-2"
          >
            Analisar “{query.trim().toUpperCase()}”
          </button>
        </div>
      )}
    </div>
  );
}
