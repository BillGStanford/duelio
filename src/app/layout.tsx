import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import Logo from '@/components/Logo';
import PageView from '@/components/PageView';
import { SITE_URL, THREADLINE_HOME } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Duelio: the internet disagrees with you', template: '%s | Duelio' },
  description: 'Turn the argument your group chat can\u2019t settle into a question everyone can answer. Pick a side and see where everyone lands.',
  openGraph: { siteName: 'Duelio', type: 'website', title: 'Duelio: the internet disagrees with you', description: 'Pick a side, make your case, and see where everyone lands.' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#EEF0F6' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <Link href="/" className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Logo />
            Duelio
          </Link>
          <nav aria-label="Main">
            <Link href="/submit" className="font-bold underline decoration-2 underline-offset-4 hover:text-sidea">
              Submit a dilemma
            </Link>
          </nav>
        </header>
        <div id="main">{children}</div>
        <footer className="mx-auto mt-24 max-w-5xl border-t-4 border-ink px-5 py-8 text-[0.95rem] text-mute">
          <p className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/guidelines" className="underline underline-offset-4 hover:text-ink">Community guidelines</Link>
            <Link href="/submit" className="underline underline-offset-4 hover:text-ink">Submit a dilemma</Link>
            <span>
              Discussions powered by{' '}
              <a href={THREADLINE_HOME} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-ink">Threadline</a>.
            </span>
          </p>
        </footer>
        <PageView />
      </body>
    </html>
  );
}
