'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-br">
      <body className="antialiased">
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-background text-on-surface">
          <h2 className="text-3xl font-headline mb-4">Erro Crítico</h2>
          <p className="mb-8 opacity-70">Ocorreu um erro inesperado no sistema.</p>
          <button
            onClick={() => reset()}
            className="px-8 py-3 bg-primary text-white rounded-full transition-transform hover:scale-105"
          >
            Recarregar Aplicativo
          </button>
        </div>
      </body>
    </html>
  );
}
