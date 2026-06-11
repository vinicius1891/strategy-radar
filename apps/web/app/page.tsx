'use client';

import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { Header } from '@/components/Header';
import { SearchBox } from '@/components/SearchBox';

const POPULAR = ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'WEGE3', 'MGLU3', 'B3SA3', 'BOVA11'];

export default function HomePage() {
  return (
    <AuthGuard>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-20">
        <h1 className="text-center text-3xl font-bold text-white">
          Quais estrategias enxergam oportunidade <span className="text-accent">neste ativo agora?</span>
        </h1>
        <p className="mt-3 text-center text-gray-400">
          Escolha um ativo. O radar executa as estrategias cadastradas e mostra quais possuem setup
          detectado, quais estao armando e onde estao entrada, stop e alvo.
        </p>

        <div className="mt-8">
          <SearchBox />
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {POPULAR.map((t) => (
            <Link
              key={t}
              href={`/asset/${t}`}
              className="rounded-full border border-edge bg-panel px-4 py-1.5 text-sm font-medium text-gray-300 transition hover:border-accent hover:text-white"
            >
              {t}
            </Link>
          ))}
        </div>
      </main>
    </AuthGuard>
  );
}
