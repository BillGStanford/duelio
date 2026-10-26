'use client';

import { useEffect, useState } from 'react';
import type { ChallengeParams, GameMode } from '@/lib/wikirush/types';
import { ROUND_OPTIONS, TIME_OPTIONS } from '@/lib/wikirush/types';
import type { WikiPrefs, WikiStats } from '@/lib/wikirush/stats';
import { liveDailyStreak } from '@/lib/wikirush/stats';
import { dailyNumber } from '@/lib/wikirush/rounds';
import { formatScore, settingsLabel } from '@/lib/wikirush/share';
import { maxScore } from '@/lib/wikirush/scoring';
import type { Featured } from '@/lib/wikirush/featured';
import type { RecordRow } from '@/lib/wikirush/records';
import { fmtMs } from '@/lib/wikirush/records';
import ChallengeBoard from '@/components/game/ChallengeBoard';
import ShareChallenge from '@/components/game/ShareChallenge';

export type BoardRow = { display_name: string; total: number };

type Props = {
  prefs: WikiPrefs;
  setPrefs(p: WikiPrefs): void;
  stats: WikiStats;
  dailyKey: string;
  dailyScore?: number;
  challenge: ChallengeParams | null;
  busy: boolean;
  error: string;
  notice: string;
  board: BoardRow[] | null;
  onStart(mode: GameMode | 'hard'): void;
  featured?: Featured[];
  highlightId?: string;
  onStartFeatured?(f: Featured): void;
  /** Mode highlighted when the player arrives from a home-screen card. */
  pick?: string;
  beat?: RecordRow | null;
  onPlayBeat?(): void;
};

function untilNextDaily() {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const mins = Math.max(0, Math.floor((next - now.getTime()) / 60000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string; hint?: string }>; onChange(v: T): void; label: string }) {
  return <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-2">
    {options.map(o => <button key={String(o.value)} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
      className={`rounded-xl border-2 px-2 py-2.5 text-sm font-bold transition ${o.value === value ? 'border-[#6978f5] bg-[#6978f5]/30 text-white' : 'border-white/15 text-white/75 hover:border-white/40'}`}>
      {o.label}{o.hint && <span className="block text-[11px] font-semibold text-white/50">{o.hint}</span>}
    </button>)}
  </div>;
}

/* eslint-disable @next/next/no-img-element */
function Mode({ id, extra = '', img, tag, title, text, onClick, disabled, cta = 'Play' }: { id: string; extra?: string; img: string; tag: string; title: string; text: string; onClick(): void; disabled?: boolean; cta?: string }) {
  return <button type="button" onClick={onClick} disabled={disabled} id={id} className={`gx-mode group h-full w-full text-left disabled:opacity-60${extra}`}>
    <img src={img} alt="" loading="lazy" width={960} height={600} />
    <span className="gx-mode-tag">{tag}</span>
    <div className="gx-mode-body">
      <h3 className="text-lg font-bold leading-tight">{title}</h3>
      <p className="mt-1 text-sm leading-snug text-white/70">{text}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#aeb7ff] transition group-hover:gap-2 group-hover:text-white">{disabled ? 'Loading…' : cta} <span aria-hidden="true">→</span></span>
    </div>
  </button>;
}

export default function Lobby({ prefs, setPrefs, stats, dailyKey, dailyScore, challenge, busy, error, notice, board, onStart, featured = [], highlightId, onStartFeatured, pick = '', beat, onPlayBeat }: Props) {
  const [until, setUntil] = useState('');
  useEffect(() => { setUntil(untilNextDaily()); const id = window.setInterval(() => setUntil(untilNextDaily()), 30000); return () => window.clearInterval(id); }, []);
  useEffect(() => { if (pick) window.setTimeout(() => document.getElementById(`mode-${pick}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250); }, [pick]);
  const ring = (k: string) => pick === k ? ' outline outline-4 outline-offset-2 outline-[#fbbf24]/80 gx-pop' : '';
  const streak = liveDailyStreak(stats, dailyKey);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.parse(`${dailyKey}T00:00:00Z`) - (6 - i) * 86400000);
    const key = date.toISOString().slice(0, 10);
    return { key, label: date.toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' }), score: stats.daily[key], today: key === dailyKey };
  });
  const winRate = stats.rounds ? Math.round((stats.wins / stats.rounds) * 100) : 0;

  return <div className="space-y-6">
    {challenge && <section className="gx-rise overflow-hidden rounded-3xl bg-gradient-to-r from-[#6978f5] to-[#fb7185] p-[2px]">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-[#0e1330] p-5">
        <div>
          <p className="gx-eyebrow">You’ve been challenged</p>
          <p className="mt-1 text-xl font-bold">{challenge.name ? `${challenge.name} wants you to beat ` : 'Beat '}{typeof challenge.score === 'number' ? <span className="text-[var(--gx-gold)]">{formatScore(challenge.score)} pts</span> : 'their run'}</p>
          <p className="text-sm text-white/60">Same pages · {settingsLabel({ mode: 'challenge', rounds: challenge.rounds, seconds: challenge.seconds })}</p>
        </div>
        <button disabled={busy} onClick={() => onStart('challenge')} className="gx-btn gx-btn-gold">Accept challenge →</button>
      </div>
    </section>}

    {beat && beat.start_title && <section aria-label="Beat the record" className="gx-rise overflow-hidden rounded-3xl bg-gradient-to-r from-[#fbbf24] to-[#fb7185] p-[2px]">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-[#0e1330] p-5">
        <div>
          <p className="gx-eyebrow !text-[var(--gx-gold)]">🏆 Beat the world record</p>
          <p className="mt-1 text-xl font-bold">{beat.start_title} → {beat.target_title}</p>
          <p className="text-sm text-white/65">Record: <b className="text-[var(--gx-gold)]">{fmtMs(beat.elapsed_ms || 0)}</b> in {beat.clicks} click{beat.clicks === 1 ? '' : 's'} by {beat.display_name}</p>
        </div>
        <button disabled={busy} onClick={onPlayBeat} className="gx-btn gx-btn-gold">▶ Take the record</button>
      </div>
    </section>}

    {featured.length > 0 && <section aria-label="Featured challenges">
      <p className="gx-eyebrow mb-3">⭐ Featured challenges</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {featured.map(f => <article key={f.id} id={`feat-${f.id}`} className={`gx-card flex flex-col justify-between p-5 ${highlightId === f.id ? '!border-[#6978f5] ring-4 ring-[#6978f5]/30' : ''}`}>
          <div>
            {f.day > 0 && <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--gx-pink)]">Day {f.day} Challenge</p>}
            <h3 className="text-lg font-bold leading-tight">{f.title}</h3>
            {f.blurb && <p className="mt-1 text-sm text-white/65">{f.blurb}</p>}
            <p className="mt-2 text-sm font-semibold text-white/85">{f.pairs[0].start} → {f.pairs[0].target}{f.pairs.length > 1 ? ` +${f.pairs.length - 1} more` : ''}</p>
          </div>
          <div className="mt-4"><p className="gx-label">Top scores</p><ChallengeBoard featuredId={f.id} limit={3} /></div>
          <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={() => onStartFeatured?.(f)} className="gx-btn">▶ Play · {f.pairs.length} round{f.pairs.length === 1 ? '' : 's'}</button><ShareChallenge f={f} className="gx-btn gx-btn-ghost" /></div>
        </article>)}
      </div>
    </section>}

    {/* Daily mission */}
    <section id="mode-daily" aria-label="Daily challenge" className={`gx-mode block !cursor-default${ring('daily')}`}>
      <div className="grid md:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
        <img src="/game/mode-daily.jpg" alt="" width={960} height={600} className="h-full min-h-[180px] w-full object-cover md:!aspect-auto" />
        <div className="p-5 sm:p-6">
          <p className="gx-eyebrow">Daily challenge #{dailyNumber(dailyKey)}</p>
          <h2 className="gx-h mt-2 text-3xl">Same 5 pages for everyone</h2>
          <p className="mt-2 text-sm text-white/70">Reset at midnight UTC. Compare scores with the world and keep your streak alive.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button disabled={busy} onClick={() => onStart('daily')} className="gx-btn gx-btn-gold">{busy ? 'Loading…' : dailyScore !== undefined ? 'Play again (practice)' : '▶ Play today’s daily'}</button>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold">🔥 {streak}-day streak</span>
            {dailyScore !== undefined && <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold">Today: {formatScore(dailyScore)}</span>}
          </div>
          <p className="mt-2 text-xs font-semibold text-white/50">New one in {until || '…'}</p>
          <ol aria-label="Your last 7 days" className="mt-4 grid grid-cols-7 gap-2 text-center">
            {week.map(d => <li key={d.key} className="min-w-0">
              <span className={`mx-auto grid h-9 w-9 place-items-center rounded-full text-xs font-bold ${d.score !== undefined ? 'bg-[var(--gx-gold)] text-[#3a2300]' : d.today ? 'border-2 border-dashed border-white/60 text-white/80' : 'bg-white/10 text-white/40'}`}>{d.score !== undefined ? '✓' : d.today ? '?' : '·'}</span>
              <span className="mt-1 block text-[10px] font-bold text-white/55">{d.label}</span>
            </li>)}
          </ol>
        </div>
      </div>
    </section>

    {/* Free play */}
    <section aria-label="Free play">
      <p className="gx-eyebrow mb-3">Free play</p>
      <div className="grid gap-3 sm:grid-cols-3 sm:gap-5">
        <Mode id="mode-quick" extra={ring('quick')} img="/game/mode-quick.jpg" tag="Quick" title="Quick Play" text="Fresh pages picked for your level. Share the link and a friend gets your exact rounds." onClick={() => onStart('classic')} disabled={busy} />
        <Mode id="mode-hard" extra={ring('hard')} img="/game/mode-hard.jpg" tag="Expert" title="Hard Mode" text="Far-apart pages and no easy hubs. Bring your best route." onClick={() => onStart('hard')} disabled={busy} />
        <Mode id="mode-wild" extra={ring('wild')} img="/game/mode-wild.jpg" tag="Chaos" title="Wild" text="Start on a random page. The target is still a famous one." onClick={() => onStart('wild')} disabled={busy} />
      </div>
    </section>

    {(error || notice) && <p role={error ? 'alert' : 'status'} className={`rounded-xl p-3 text-sm font-semibold ${error ? 'bg-rose-500/15 text-rose-200' : 'bg-[#6978f5]/20 text-[#d6dbff]'}`}>{error || notice}</p>}

    {/* Settings */}
    <section className="gx-card p-5 sm:p-6">
      <h3 className="text-lg font-bold">Game settings</h3>
      <p className="mt-0.5 text-xs text-white/55">For Quick, Hard and Wild. The Daily is always 5 rounds · 90s.</p>
      <p className="gx-label mt-4">Rounds</p>
      <Seg label="Rounds" value={prefs.rounds} onChange={v => setPrefs({ ...prefs, rounds: v })} options={ROUND_OPTIONS.map(r => ({ value: r as number, label: r === 1 ? 'Practice' : `${r} rounds`, hint: `max ${formatScore(maxScore(r))}` }))} />
      <p className="gx-label mt-4">Pace</p>
      <Seg label="Seconds per round" value={prefs.seconds} onChange={v => setPrefs({ ...prefs, seconds: v })} options={TIME_OPTIONS.map(t => ({ value: t.seconds as number, label: t.label, hint: t.hint }))} />
      <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl bg-white/[.07] px-4 py-3 text-sm font-bold">
        <span>Sound effects</span>
        <input type="checkbox" checked={prefs.sound} onChange={e => setPrefs({ ...prefs, sound: e.target.checked })} className="h-5 w-5 accent-[#6978f5]" />
      </label>
    </section>

    {/* Stats */}
    <section aria-label="Your stats" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {[
        ['🔥', String(streak), 'daily streak'],
        ['🎮', String(stats.games), 'games'],
        ['🏆', stats.bestScore ? formatScore(stats.bestScore) : '—', 'best 5-round'],
        ['⚡', stats.fastestMs ? `${(stats.fastestMs / 1000).toFixed(1)}s` : '—', 'fastest arrival'],
        ['🎯', stats.rounds ? `${winRate}%` : '—', 'pages reached'],
      ].map(([icon, value, label]) => <div key={label} className="gx-card p-4">
        <p className="text-lg">{icon}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p><p className="text-xs font-semibold text-white/55">{label}</p>
      </div>)}
    </section>

    {board && board.length > 0 && <section className="gx-card p-5">
      <h3 className="text-lg font-bold">Today’s daily · top explorers</h3>
      <ol className="mt-3 divide-y divide-white/10">
        {board.map((r, i) => <li key={`${r.display_name}-${i}`} className="flex items-center justify-between py-2.5 text-sm">
          <span className="font-semibold"><span className="mr-3 inline-block w-6 text-white/45">{i + 1}</span>{r.display_name}</span><span className="font-bold tabular-nums text-[var(--gx-gold)]">{formatScore(r.total)}</span>
        </li>)}
      </ol>
    </section>}

    {/* How scoring works */}
    <section className="gx-card p-6">
      <h3 className="text-xl font-bold">How scoring works</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {[['2,000', 'for arriving at the destination'], ['up to 2,000', 'for speed. The clock pauses while pages load'], ['up to 1,000', 'for efficiency: fewer clicks, more points'], ['−600', 'if you use Radar to spot the link']].map(([n, t]) => <div key={n} className="rounded-2xl bg-white/[.07] p-4"><p className="text-2xl font-bold text-[#aeb7ff]">{n}</p><p className="mt-1 text-sm text-white/70">{t}</p></div>)}
      </div>
      <p className="mt-4 text-sm text-white/60">Perfect round: 5,000. Time out one click away and you still bank 600. Hubs like countries, years and big cities are your best friends.</p>
    </section>
  </div>;
}
