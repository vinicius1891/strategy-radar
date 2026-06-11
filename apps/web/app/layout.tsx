import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Strategy Radar',
  description: 'Quais estrategias enxergam oportunidade neste ativo agora?',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-gray-500">
          Strategy Radar exibe setups detectados por regras tecnicas configuraveis. Nao constitui
          recomendacao de investimento. Decisoes sao de responsabilidade do usuario.
        </footer>
      </body>
    </html>
  );
}
