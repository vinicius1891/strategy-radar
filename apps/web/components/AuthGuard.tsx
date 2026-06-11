'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/api';

// Protege paginas autenticadas no cliente; sem token, redireciona ao login.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) {
    return <div className="flex min-h-[60vh] items-center justify-center text-gray-500">Carregando…</div>;
  }
  return <>{children}</>;
}
