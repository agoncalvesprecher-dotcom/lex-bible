import type {Metadata} from 'next';
import { Manrope, Newsreader, Comfortaa, Dancing_Script, Anton } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
});

const comfortaa = Comfortaa({
  subsets: ['latin'],
  variable: '--font-comfortaa',
  display: 'swap',
});

const dancingScript = Dancing_Script({
  subsets: ['latin'],
  variable: '--font-manuscrito',
  display: 'swap',
});

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-negritos',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LEX BIBLE | Escrituras Sagradas',
  description: 'Uma biblioteca digital sagrada para estudo e meditação das Escrituras.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-br" suppressHydrationWarning className={`${manrope.variable} ${newsreader.variable} ${comfortaa.variable} ${dancingScript.variable} ${anton.variable}`}>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
