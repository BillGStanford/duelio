'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { loadPrefs, savePrefs } from '@/lib/wikirush/stats';
import { canReel } from '@/lib/wikirush/recorder';

type Props = {
  /** On /wikirush these start the game in place; on the home page they are plain links. */
  onPlay?(): void;
  onDaily?(): void;
  busy?: boolean;
  dailyDone?: boolean;
  dailyNumber?: number;
  headline?: 'h1' | 'p';
  /** Controlled on /wikirush. On the home page the toggle manages itself through saved preferences. */
  record?: boolean;
  onRecordChange?(on: boolean): void;
  footer?: ReactNode;
};

const ROUTE = ['Melania Trump', 'Slovenia', 'Planet', 'Mars'];

function Cta({ onClick, href, className, children, disabled }: { onClick?(): void; href: string; className: string; children: ReactNode; disabled?: boolean }) {
  return onClick
    ? <button type="button" onClick={onClick} disabled={disabled} className={className}>{children}</button>
    : <Link href={href} className={className}>{children}</Link>;
}

/** The title screen: reads as a game at a glance, before any gameplay. */
export default function MenuHero({ onPlay, onDaily, busy, dailyDone, dailyNumber, headline = 'h1', footer, record, onRecordChange }: Props) {
  const H = headline;
  const [own, setOwn] = useState(true);
  const [able, setAble] = useState(false);
  useEffect(() => { setOwn(loadPrefs().record); setAble(canReel()); }, []);
  const on = record ?? own;
  function toggle() {
    const next = !on;
    if (onRecordChange) onRecordChange(next);
    else { setOwn(next); savePrefs({ ...loadPrefs(), record: next }); }
  }
  return <section aria-label="WikiRush title screen" className="wr-menu relative isolate overflow-hidden bg-[#0b0f1f] text-white">
    <div aria-hidden="true" className="absolute inset-0 -z-10 bg-cover bg-center opacity-50" style={{ backgroundImage: 'url(/wikirush/wr-bg-landscape.jpg)' }} />
    <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(70% 90% at 50% 0%, rgba(105,120,245,.35), transparent 60%), linear-gradient(180deg, rgba(11,15,31,.2), #0b0f1f 96%)' }} />
    <div className="mx-auto flex max-w-5xl flex-col items-center px-5 pb-10 pt-12 text-center sm:pt-16">
      <p className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[.24em] text-[#aeb7ff]">The Wikipedia link race</p>
      <H className="wr-logo mt-4 text-6xl font-black leading-none tracking-[-.07em] sm:text-8xl">
        Wiki<span className="text-[#aeb7ff]">Rush</span>
      </H>
      <p className="mt-4 max-w-xl text-lg font-semibold text-white/80 sm:text-xl">
        Get from one Wikipedia page to another using only links. Fastest route wins.
      </p>

      <ol aria-label="Example route" className="mt-8 flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-2 gap-y-3">
        {ROUTE.map((t, i) => <li key={t} className="flex items-center gap-2">
          <span className={`wr-hop rounded-xl border px-3 py-2 text-sm font-extrabold sm:text-base ${i === 0 ? 'border-emerald-300/50 bg-emerald-400/15 text-emerald-100' : i === ROUTE.length - 1 ? 'border-amber-300/60 bg-amber-300/15 text-amber-100' : 'border-white/15 bg-white/10 text-white/85'}`} style={{ animationDelay: `${i * 0.7}s` }}>
            {i === 0 && <span aria-hidden="true">📍 </span>}{i === ROUTE.length - 1 && <span aria-hidden="true">🎯 </span>}{t}
          </span>
          {i < ROUTE.length - 1 && <span aria-hidden="true" className="wr-arrow text-[#aeb7ff]" style={{ animationDelay: `${i * 0.7 + 0.35}s` }}>→</span>}
        </li>)}
      </ol>

      <div className="mt-9 flex w-full max-w-md flex-col gap-3">
        <Cta onClick={onPlay} disabled={busy} href="/wikirush?play=1" className="wr-play min-h-16 rounded-2xl bg-[#6978f5] px-8 py-4 text-2xl font-black tracking-tight text-white shadow-[0_8px_0_#3b46c4,0_18px_40px_rgba(105,120,245,.45)] transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_3px_0_#3b46c4] disabled:opacity-60">
          ▶ PLAY
        </Cta>
        <Cta onClick={onDaily} disabled={busy} href="/wikirush?daily=1" className="min-h-14 rounded-2xl border-2 border-amber-300/70 bg-amber-300/10 px-6 py-3 text-lg font-black text-amber-100 transition hover:bg-amber-300/20 disabled:opacity-60">
          📅 Daily Challenge{dailyNumber ? ` #${dailyNumber}` : ''}{dailyDone ? ' · played ✓' : ''}
        </Cta>
        {able && <button type="button" role="switch" aria-checked={on} onClick={toggle} className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${on ? 'border-rose-400/70 bg-rose-500/15' : 'border-white/15 bg-white/5'}`}>
          <span><span className="block text-sm font-black">🎥 Record my run {on ? '· ON' : '· OFF'}</span><span className="block text-xs font-semibold text-white/60">Branded video downloads by itself when the game ends</span></span>
          <span className={`relative h-7 w-12 shrink-0 rounded-full ${on ? 'bg-rose-500' : 'bg-white/25'}`}><span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} /></span>
        </button>}
        <p className="text-sm font-semibold text-white/60">Free to play · first game needs no account · 90 seconds a round</p>
      </div>

      <ul className="mt-8 grid w-full max-w-3xl grid-cols-3 gap-2 text-xs font-bold text-white/70 sm:gap-3 sm:text-sm">
        {[['⚡', 'Instant pages', 'Prefetched, no waiting'], ['🎥', 'Auto-record', 'Clip downloads itself'], ['🔗', 'Challenge friends', 'One link, same pages']].map(([i, t, d]) =>
          <li key={t} className="rounded-2xl border border-white/10 bg-white/[.06] p-3 backdrop-blur-sm"><span aria-hidden="true" className="text-xl">{i}</span><span className="mt-1 block font-black text-white">{t}</span><span className="hidden sm:block">{d}</span></li>)}
      </ul>
      {footer}
    </div>
  </section>;
}
