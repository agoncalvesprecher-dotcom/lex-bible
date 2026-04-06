'use client';

import { useEffect } from 'react';

export default function Error({
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
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-background text-on-surface">
      <h2 className="text-2xl font-headline mb-4">Algo deu errado!</h2>
      <button
        onClick={() => reset()}
        className="px-6 py-2 bg-primary text-white rounded-full transition-transform hover:scale-105"
      >
        Tentar novamente
      </button>
    </div>
  );
}
