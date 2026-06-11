'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError, setSession } from '@/lib/api';
import { AuthResponse } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('demo@strategyradar.app');
  const [password, setPassword] = useState('demo1234');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body =
        mode === 'login' ? { email, password } : { email, password, name };
      const res = await api<AuthResponse>(`/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setSession(res.accessToken, res.user);
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-edge bg-panel p-8">
        <h1 className="text-center text-2xl font-bold text-white">
          Strategy <span className="text-accent">Radar</span>
        </h1>
        <p className="mt-1 text-center text-sm text-gray-400">
          Quais estrategias enxergam oportunidade neste ativo agora?
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === 'register' && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome"
              required
              minLength={2}
              className="w-full rounded-lg border border-edge bg-panel-2 px-3 py-2 text-gray-100 outline-none focus:border-accent"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            required
            className="w-full rounded-lg border border-edge bg-panel-2 px-3 py-2 text-gray-100 outline-none focus:border-accent"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            required
            minLength={8}
            className="w-full rounded-lg border border-edge bg-panel-2 px-3 py-2 text-gray-100 outline-none focus:border-accent"
          />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent py-2 font-semibold text-gray-950 transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="mt-4 w-full text-center text-sm text-gray-400 hover:text-white"
        >
          {mode === 'login' ? 'Nao tem conta? Cadastre-se' : 'Ja tem conta? Entrar'}
        </button>

        <p className="mt-4 rounded-lg bg-panel-2 p-3 text-center text-xs text-gray-500">
          Demo: demo@strategyradar.app / demo1234
        </p>
      </div>
    </main>
  );
}
