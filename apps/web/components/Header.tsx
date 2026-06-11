'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearSession, getUser } from '@/lib/api';
import { SearchBox } from './SearchBox';

export function Header() {
  const router = useRouter();
  const user = typeof window !== 'undefined' ? getUser() : null;

  return (
    <header className="border-b border-edge bg-panel">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="shrink-0 text-lg font-bold tracking-tight text-white">
          Strategy <span className="text-accent">Radar</span>
        </Link>
        <div className="flex-1">
          <SearchBox compact />
        </div>
        <nav className="flex items-center gap-4 text-sm text-gray-300">
          <Link href="/strategies" className="hover:text-white">
            Estrategias
          </Link>
          {user && (
            <button
              className="text-gray-400 hover:text-white"
              onClick={() => {
                clearSession();
                router.push('/login');
              }}
            >
              Sair
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
