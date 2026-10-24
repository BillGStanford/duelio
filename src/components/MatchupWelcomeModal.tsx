'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import MatchupCreator from './MatchupCreator';

const DISMISSED_KEY = 'duelio-welcome-matchup-dismissed-v1';

export default function MatchupWelcomeModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // The landing page is the WikiRush title screen now: a first-visit popup would cover the game.
    // Kept opt-in via ?welcome=1 so the matchup creator is still reachable.
    if (pathname !== '/' || !new URLSearchParams(window.location.search).has('welcome')) { setOpen(false); return; }
    try {
      if (window.localStorage.getItem(DISMISSED_KEY) !== 'yes') setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [pathname]);

  const dismiss = useCallback(() => {
    try { window.localStorage.setItem(DISMISSED_KEY, 'yes'); } catch {}
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, dismiss]);

  if (!open || pathname !== '/') return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#101525]/70 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) dismiss(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="welcome-title" className="relative my-auto w-full max-w-3xl rounded-3xl border border-white/70 bg-white p-5 shadow-2xl sm:p-8">
        <button type="button" onClick={dismiss} aria-label="Close matchup creator" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-rule bg-white text-xl font-bold text-mute hover:bg-paper hover:text-ink">×</button>
        <div className="mb-5 flex items-center gap-3 pr-10">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-lg font-black text-white">VS</div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sidea">Welcome to Duelio</p>
            <h2 id="welcome-title" className="text-xl font-black tracking-tight sm:text-2xl">Settle a debate in seconds.</h2>
          </div>
        </div>
        <MatchupCreator variant="modal" />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
          <p className="text-xs text-mute">No account. No cost. Just pick two sides.</p>
          <button type="button" onClick={dismiss} className="min-h-10 rounded-full px-4 py-2 text-sm font-bold text-mute hover:bg-paper hover:text-ink">Explore first →</button>
        </div>
      </section>
    </div>
  );
}
