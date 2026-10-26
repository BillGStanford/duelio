'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAccount } from '@/lib/account';
import { LEVELS, levelFor } from '@/lib/wikirush/levels';
import { Avatar, Emblem, Pip } from './Art';

const I = (d: ReactNode) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const ICONS = {
  play: I(<path d="M7 4.5v15l12-7.5z" fill="currentColor" />),
  duel: I(<><path d="M5 19 19 5M14 5h5v5M5 5l14 14" /></>),
  dilemma: I(<><path d="M12 4v16M6 20h12M4 8h16" /><path d="M7 8 4 14a3 3 0 0 0 6 0zM17 8l-3 6a3 3 0 0 0 6 0z" /></>),
  ranks: I(<><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v2a3 3 0 0 0 4 3M16 6h4v2a3 3 0 0 1-4 3M12 13v4M8 20h8" /></>),
  me: I(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
};

const TABS = [
  { href: '/', label: 'Play', icon: ICONS.play, match: (p: string) => p === '/' || p.startsWith('/wikirush') },
  { href: '/matchups', label: 'Duel', icon: ICONS.duel, match: (p: string) => p.startsWith('/matchup') },
  { href: '/#debates', label: 'Dilemma', icon: ICONS.dilemma, match: (p: string) => p.startsWith('/d/') || p.startsWith('/submit') },
  { href: '/leaderboard', label: 'Ranks', icon: ICONS.ranks, match: (p: string) => p.startsWith('/leaderboard') || p.startsWith('/records') },
  { href: '/profile', label: 'Me', icon: ICONS.me, match: (p: string) => p.startsWith('/profile') || p.startsWith('/settings') || p.startsWith('/login') },
];

export default function GameNav() {
  const path = usePathname() || '/';
  const a = useAccount();
  const lv = levelFor(a.points);
  const idx = LEVELS.findIndex(l => l.name === lv.level.name);
  const meHref = a.signedIn ? '/profile' : '/login';

  return <div className="gx-chrome">
    <header className="gx-nav">
      <div className="gx-nav-in">
        <Link href="/" className="gx-brand" aria-label="Duelio home"><Pip size={34} /><span>Duelio</span></Link>
        <nav aria-label="Main" className="gx-links">
          {TABS.slice(0, 4).map(t => <Link key={t.label} href={t.href} aria-current={(t.label === 'Ranks' ? path.startsWith('/leaderboard') : t.match(path)) ? 'page' : undefined} className="gx-link">{t.label}</Link>)}
          <Link href="/records" aria-current={path.startsWith('/records') ? 'page' : undefined} className="gx-link">Records</Link>
        </nav>
        <div className="gx-me">
          {!a.ready ? <span className="gx-chip-skel" aria-hidden="true" />
            : a.signedIn ? <Link href="/profile" className="gx-chip" aria-label={`Your profile: ${a.name}, ${a.points} points`}>
              <Avatar n={a.avatar} size={30} />
              <span className="gx-chip-txt"><b>{a.name}</b><span><Emblem index={idx} size={14} className="inline -mt-0.5" /> {a.points.toLocaleString()} pts</span></span>
            </Link>
            : <><Link href="/login" className="gx-signin">Sign in</Link><Link href="/login?mode=signup" className="gx-btn gx-btn-sm gx-hide-sm">Join free</Link></>}
        </div>
      </div>
    </header>
    <nav aria-label="Tabs" className="gx-tabs">
      {TABS.map(t => {
        const href = t.label === 'Me' ? meHref : t.href;
        const on = t.match(path);
        return <Link key={t.label} href={href} aria-current={on ? 'page' : undefined} className="gx-tab"><span className="gx-tab-ic">{t.icon}</span><span>{t.label}</span></Link>;
      })}
    </nav>
  </div>;
}
