import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import './globals.css';
import Logo from '@/components/Logo';
import PageView from '@/components/PageView';
import { SITE_URL, THREADLINE_HOME } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Duelio — Dilemmas, matchups, and public opinion', template: '%s | Duelio' },
  description: 'Turn the argument your group chat can\u2019t settle into a question everyone can answer. Pick a side and see where everyone lands.',
  openGraph: {
    siteName: 'Duelio',
    type: 'website',
    title: 'Duelio — Dilemmas, matchups, and public opinion',
    description: 'Pick a side in everyday dilemmas or head-to-head matchups. Vote, make your case, and see where the crowd lands.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Duelio: pick a side on everyday dilemmas' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Duelio: pick a side on everyday dilemmas' }],
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#EEF0F6' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <Script id="google-analytics-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-5HEWDYYCEC');`}
        </Script>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-5HEWDYYCEC"
          strategy="afterInteractive"
        />
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <Link href="/" className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Logo />
            Duelio
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <Link href="/#debates" className="font-bold">Dilemma</Link>
            <Link href="/matchups" className="font-bold">Duel</Link>
            <Link href="/submit" className="font-bold">Submit</Link>
          </nav>
        </header>
        <div id="main">{children}</div>
        <footer className="mx-auto mt-24 max-w-5xl border-t-4 border-ink px-5 py-8 text-[0.95rem] text-mute">
          <p className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/guidelines" className="underline underline-offset-4 hover:text-ink">Community guidelines</Link>
            <Link href="/submit" className="underline underline-offset-4 hover:text-ink">Submit a dilemma</Link>
            <Link href="/matchups" className="underline underline-offset-4 hover:text-ink">Matchup board</Link>
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
