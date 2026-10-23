'use client';

import { useEffect, useState } from 'react';
import type { ChallengeParams, GameMode } from '@/lib/wikirush/types';
import { ROUND_OPTIONS, TIME_OPTIONS } from '@/lib/wikirush/types';
import type { WikiPrefs, WikiStats } from '@/lib/wikirush/stats';
import { liveDailyStreak } from '@/lib/wikirush/stats';
import { dailyNumber } from '@/lib/wikirush/rounds';
import { formatScore, settingsLabel } from '@/lib/wikirush/share';
import { maxScore } from '@/lib/wikirush/scoring';

export type BoardRow = { display_name: string; total: number };

type Props = {
  prefs: WikiPrefs;
  setPrefs(p: WikiPrefs): void;
  stats: WikiStats;
  dailyKey: string;
  dailyScore?: number;
  challenge: ChallengeParams | null;
  canScreen: boolean;
  canReel: boolean;
  busy: boolean;
  error: string;
  notice: string;
  board: BoardRow[] | null;
  onStart(mode: GameMode): void;
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
      className={`rounded-xl border px-3 py-2.5 text-sm font-extrabold transition ${o.value === value ? 'border-[#6978f5] bg-[#eef0ff] text-[#3f4dc9]' : 'border-slate-200 hover:border-slate-400'}`}>
      {o.label}{o.hint && <span className="block text-[11px] font-bold text-slate-400">{o.hint}</span>}
    </button>)}
  </div>;
}

export default function Lobby({ prefs, setPrefs, stats, dailyKey, dailyScore, challenge, canScreen, canReel, busy, error, notice, board, onStart }: Props) {
  const [until, setUntil] = useState('');
  useEffect(() => { setUntil(untilNextDaily()); const id = window.setInterval(() => setUntil(untilNextDaily()), 30000); return () => window.clearInterval(id); }, []);
  const streak = liveDailyStreak(stats, dailyKey);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.parse(`${dailyKey}T00:00:00Z`) - (6 - i) * 86400000);
    const key = date.toISOString().slice(0, 10);
    return { key, label: date.toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' }), score: stats.daily[key], today: key === dailyKey };
  });
  const winRate = stats.rounds ? Math.round((stats.wins / stats.rounds) * 100) : 0;
  const noRecording = !canScreen && !canReel;
  const method = prefs.recordMethod === 'screen' && !canScreen ? 'reel' : prefs.recordMethod;

  return <div className="space-y-6">
    {challenge && <section className="wr-rise overflow-hidden rounded-3xl bg-gradient-to-r from-[#6978f5] to-[#e75d87] p-[2px]">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-[#101426] p-5 text-white">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#aeb7ff]">You’ve been challenged</p>
          <p className="mt-1 text-xl font-black">{challenge.name ? `${challenge.name} wants you to beat ` : 'Beat '}{typeof challenge.score === 'number' ? <span className="text-amber-300">{formatScore(challenge.score)} pts</span> : 'their run'}</p>
          <p className="text-sm text-white/60">Same pages · {settingsLabel({ mode: 'challenge', rounds: challenge.rounds, seconds: challenge.seconds })}</p>
        </div>
        <button disabled={busy} onClick={() => onStart('challenge')} className="rounded-2xl bg-white px-6 py-3.5 font-black text-[#101426] hover:bg-[#eef0ff] disabled:opacity-60">Accept challenge →</button>
      </div>
    </section>}

    <div className="grid gap-4 lg:grid-cols-3">
      {/* Daily */}
      <article className="relative flex flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-[#6978f5] to-[#3b46c4] p-6 text-white shadow-lg shadow-[#6978f5]/20 lg:col-span-2">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div>
        <p className="text-xs font-black uppercase tracking-[.2em] text-white/70">Daily challenge #{dailyNumber(dailyKey)}</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Same 5 pages for everyone.</h2>
        <p className="mt-2 max-w-md text-sm text-white/80">One shared set of rounds, reset at midnight UTC. Compare scores with the whole internet and keep your streak alive.</p>
        </div>
        <div className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={busy} onClick={() => onStart('daily')} className="rounded-2xl bg-white px-7 py-3.5 text-base font-black text-[#3b46c4] shadow-md hover:-translate-y-0.5 hover:bg-[#f4f5ff] disabled:opacity-60">
            {busy ? 'Loading…' : dailyScore !== undefined ? 'Play it again' : 'Play today’s daily →'}
          </button>
          <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-extrabold">🔥 {streak}-day streak</span>
          {dailyScore !== undefined && <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-extrabold">Today: {formatScore(dailyScore)}</span>}
          <span className="text-xs font-bold text-white/60">New one in {until || '…'}</span>
        </div>
        <div className="mt-6 rounded-2xl bg-black/15 p-4" aria-label="Your last 7 days">
          <p className="text-[11px] font-black uppercase tracking-widest text-white/60">Your week</p>
          <ol className="mt-2 grid grid-cols-7 gap-2 text-center">
            {week.map(d => <li key={d.key} className="min-w-0">
              <span className={`mx-auto grid h-9 w-9 place-items-center rounded-full text-xs font-black ${d.score !== undefined ? 'bg-white text-[#3b46c4]' : d.today ? 'border-2 border-dashed border-white/70 text-white/80' : 'bg-white/10 text-white/40'}`}>{d.score !== undefined ? '✓' : d.today ? '?' : '·'}</span>
              <span className="mt-1 block text-[10px] font-bold text-white/60">{d.label}</span>
              {d.score !== undefined && <span className="block truncate text-[10px] font-black tabular-nums text-white">{formatScore(d.score)}</span>}
            </li>)}
          </ol>
        </div>
        </div>
      </article>

      {/* Quick modes */}
      <div className="grid gap-4">
        <article className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-widest text-[#6978f5]">Classic</p>
          <h3 className="mt-1 text-xl font-black">Fresh pages, shareable seed</h3>
          <p className="mt-1 text-sm text-slate-500">Curated, always winnable. Send a friend the link and they play your exact rounds.</p>
          <button disabled={busy} onClick={() => onStart('classic')} className="mt-3 w-full rounded-xl bg-[#101426] px-4 py-3 font-extrabold text-white hover:bg-[#1c2240] disabled:opacity-60">Play classic</button>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-widest text-[#e75d87]">Wild</p>
          <h3 className="mt-1 text-xl font-black">Random page, real chaos</h3>
          <p className="mt-1 text-sm text-slate-500">Start anywhere on Wikipedia. Destination is still a famous page.</p>
          <button disabled={busy} onClick={() => onStart('wild')} className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 font-extrabold hover:bg-slate-50 disabled:opacity-60">Play wild</button>
        </article>
      </div>
    </div>

    {(error || notice) && <p role={error ? 'alert' : 'status'} className={`rounded-xl p-3 text-sm font-semibold ${error ? 'bg-red-50 text-red-700' : 'bg-[#eef0ff] text-[#4857d7]'}`}>{error || notice}</p>}

    {/* Settings + recording */}
    <section className="grid items-start gap-4 md:grid-cols-2">
      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-black">Game settings</h3>
        <p className="mt-0.5 text-xs text-slate-500">Applies to Classic and Wild. The Daily is always 5 rounds · 90s.</p>
        <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-400">Rounds</p>
        <div className="mt-2"><Seg label="Rounds" value={prefs.rounds} onChange={v => setPrefs({ ...prefs, rounds: v })} options={ROUND_OPTIONS.map(r => ({ value: r as number, label: r === 1 ? '1 · Practice' : `${r} rounds`, hint: `max ${formatScore(maxScore(r))}` }))} /></div>
        <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-400">Pace</p>
        <div className="mt-2"><Seg label="Seconds per round" value={prefs.seconds} onChange={v => setPrefs({ ...prefs, seconds: v })} options={TIME_OPTIONS.map(t => ({ value: t.seconds as number, label: t.label, hint: t.hint }))} /></div>
        <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold">
          <span>Sound effects</span>
          <input type="checkbox" checked={prefs.sound} onChange={e => setPrefs({ ...prefs, sound: e.target.checked })} className="h-5 w-5 accent-[#6978f5]" />
        </label>
      </div>

      <div className={`rounded-3xl border p-5 transition ${prefs.record ? 'border-[#e75d87]/60 bg-[#fff5f8]' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black">🎥 Record my run</h3>
            <p className="mt-0.5 text-sm text-slate-500">Makes a video with the Duelio intro, watermark and score outro. It ends when the game does and downloads automatically.</p>
          </div>
          <button role="switch" aria-checked={prefs.record && !noRecording} disabled={noRecording} aria-label="Record my run" onClick={() => setPrefs({ ...prefs, record: !prefs.record })}
            className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${prefs.record && !noRecording ? 'bg-[#e75d87]' : 'bg-slate-300'}`}>
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${prefs.record && !noRecording ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
        {noRecording && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">This browser can’t record video. Try Chrome, Edge, Safari 14.1+ or Firefox.</p>}
        {prefs.record && !noRecording && <div className="wr-rise mt-4 space-y-2">
          <button disabled={!canScreen} onClick={() => setPrefs({ ...prefs, recordMethod: 'screen' })} aria-pressed={method === 'screen'}
            className={`w-full rounded-xl border p-3 text-left disabled:opacity-50 ${method === 'screen' ? 'border-[#e75d87] bg-white' : 'border-slate-200 bg-white/60'}`}>
            <p className="text-sm font-black">Screen capture · landscape</p>
            <p className="text-xs text-slate-500">{canScreen ? 'Records the actual game, with our overlay on top. Your browser will ask what to share: pick “This tab”.' : 'Not available on this device.'}</p>
          </button>
          <button disabled={!canReel} onClick={() => setPrefs({ ...prefs, recordMethod: 'reel' })} aria-pressed={method === 'reel'}
            className={`w-full rounded-xl border p-3 text-left disabled:opacity-50 ${method === 'reel' ? 'border-[#e75d87] bg-white' : 'border-slate-200 bg-white/60'}`}>
            <p className="text-sm font-black">Vertical reel · 9:16</p>
            <p className="text-xs text-slate-500">A branded, share-ready scene drawn from your run. No permission prompt, works on phones. Made for TikTok, Reels and Shorts.</p>
          </button>
          <p className="text-xs text-slate-500">Nothing is uploaded. The video is built and saved on your device.</p>
        </div>}
      </div>
    </section>

    {/* Stats */}
    <section aria-label="Your stats" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {[
        ['🔥', String(streak), 'daily streak'],
        ['🎮', String(stats.games), 'games'],
        ['🏆', stats.bestScore ? formatScore(stats.bestScore) : '—', 'best 5-round'],
        ['⚡', stats.fastestMs ? `${(stats.fastestMs / 1000).toFixed(1)}s` : '—', 'fastest arrival'],
        ['🎯', stats.rounds ? `${winRate}%` : '—', 'pages reached'],
      ].map(([icon, value, label]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-lg">{icon}</p><p className="mt-1 text-2xl font-black tabular-nums">{value}</p><p className="text-xs font-bold text-slate-500">{label}</p>
      </div>)}
    </section>

    {board && board.length > 0 && <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-black">Today’s daily · top explorers</h3>
      <ol className="mt-3 divide-y divide-slate-100">
        {board.map((r, i) => <li key={`${r.display_name}-${i}`} className="flex items-center justify-between py-2.5 text-sm">
          <span className="font-bold"><span className="mr-3 inline-block w-6 text-slate-400">{i + 1}</span>{r.display_name}</span><span className="font-black tabular-nums">{formatScore(r.total)}</span>
        </li>)}
      </ol>
    </section>}

    {/* How scoring works */}
    <section className="rounded-3xl bg-[#101426] p-6 text-white">
      <h3 className="text-xl font-black">How scoring works</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {[['2,000', 'for arriving at the destination'], ['up to 2,000', 'for speed. The clock pauses while pages load'], ['up to 1,000', 'for efficiency: fewer clicks, more points'], ['−600', 'if you use Radar to spot the link']].map(([n, t]) => <div key={n} className="rounded-2xl bg-white/[.06] p-4"><p className="text-2xl font-black text-[#aeb7ff]">{n}</p><p className="mt-1 text-sm text-white/70">{t}</p></div>)}
      </div>
      <p className="mt-4 text-sm text-white/60">Perfect round: 5,000. Time out one click away and you still bank 600. Hubs like countries, years and big cities are your best friends.</p>
    </section>
  </div>;
}
