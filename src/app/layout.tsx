import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import './globals.css';
import localFont from 'next/font/local';
import GameNav from '@/components/game/GameNav';
import PageView from '@/components/PageView';
import MatchupWelcomeModal from '@/components/MatchupWelcomeModal';
import DiscordFloatingButton from '@/components/DiscordFloatingButton';
import { SITE_URL, THREADLINE_HOME } from '@/lib/site';

const poppins = localFont({
  src: [
    { path: '../assets/Poppins-Regular.ttf', weight: '400' },
    { path: '../assets/Poppins-Medium.ttf', weight: '500' },
    { path: '../assets/Poppins-Bold.ttf', weight: '700' },
  ],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'WikiRush: The Wikipedia Link Race Game | Duelio', template: '%s | Duelio' },
  description: 'WikiRush is a free Wikipedia game: race from one page to another using only links. Daily challenge, leaderboard and shareable runs. Plus Duelio dilemmas and matchups.',
  keywords: ['WikiRush', 'Wiki Rush', 'Wikipedia game', 'wikiracing', 'Wikipedia race', 'GeoGuessr for Wikipedia', 'Duelio'],
  alternates: { canonical: '/' },
  openGraph: {
    siteName: 'Duelio',
    type: 'website',
    title: 'WikiRush: The Wikipedia Link Race Game',
    description: 'Get from one Wikipedia page to another using only links. Free, instant, and built to share. Play the Daily Challenge.',
    images: [{ url: '/game/og.png', width: 1200, height: 630, alt: 'WikiRush by Duelio: the Wikipedia link race game' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WikiRush: The Wikipedia Link Race Game',
    description: 'Get from one Wikipedia page to another using only links. Free, instant, and built to share.',
    images: [{ url: '/game/og.png', width: 1200, height: 630, alt: 'WikiRush by Duelio: the Wikipedia link race game' }],
  },
  other: { 'google-adsense-account': 'ca-pub-5222388837833339' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b0f1f' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} font-sans`}>
        <Script
          id="google-adsense"
          strategy="beforeInteractive"
          crossOrigin="anonymous"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5222388837833339"
        />
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
        <GameNav />
        <div id="main">{children}</div>
        <div className="gx-foot-wrap"><footer className="gx-foot">
          <div className="gx-foot-in">
            <p className="gx-foot-brand">Duelio</p>
            <nav aria-label="Footer" className="gx-foot-links">
              <Link href="/wikirush">WikiRush</Link>
              <Link href="/wikirush/how-to-play">How to play</Link>
              <Link href="/matchups">Duel</Link>
              <Link href="/#debates">Dilemma</Link>
              <Link href="/leaderboard">Leaderboard</Link>
              <Link href="/submit">Submit</Link>
              <Link href="/guidelines">Guidelines</Link>
            </nav>
            <p className="gx-foot-note">Discussions powered by{' '}<a href={THREADLINE_HOME} target="_blank" rel="noopener noreferrer">Threadline</a>. Wikipedia text is shared under CC BY-SA.</p>
          </div>
        </footer></div>
        <MatchupWelcomeModal />
        <DiscordFloatingButton />
        <PageView />
      </body>
    </html>
  );
}
