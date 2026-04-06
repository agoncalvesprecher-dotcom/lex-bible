'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-on-surface p-4 text-center">
      <h2 className="text-4xl font-headline mb-4">404 - Página não encontrada</h2>
      <p className="text-lg mb-8 opacity-70">Desculpe, não conseguimos encontrar a página que você está procurando.</p>
      <Link 
        href="/"
        className="px-6 py-3 bg-primary text-white rounded-full font-medium transition-transform hover:scale-105 active:scale-95"
      >
        Voltar para a Biblioteca
      </Link>
    </div>
  );
}
