'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Shell from '@/components/game/Shell';
import { Avatar } from '@/components/game/Art';
import ChallengeBoard from '@/components/game/ChallengeBoard';
import ShareChallenge from '@/components/game/ShareChallenge';
import { getWikiClient } from '@/lib/wikirush-client';
import { avatarFor } from '@/lib/players';
import { bestGames, pairRecords, sweeps, topFinds } from '@/lib/recordsClient';
import { fmtMs, type RecordRow } from '@/lib/wikirush/records';
import type { Featured } from '@/lib/wikirush/featured';

type Tab = 'finds' | 'pairs' | 'games' | 'sweeps' | 'challenges';
const TABS: Array<[Tab, string]> = [['finds', 'Fastest finds'], ['pairs', 'Page records'], ['games', 'Best games'], ['sweeps', 'Clean sweeps'], ['challenges', 'Challenges']];
const ago = (iso: string) => { const d = Math.max(0, Date.now() - Date.parse(iso)); const m = Math.floor(d / 60000); if (m < 60) return `${Math.max(1, m)}m ago`; const h = Math.floor(m / 60); if (h < 48) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`; };

function Who({ r }: { r: RecordRow }) {
  return <div className="flex min-w-0 items-center gap-2.5"><Avatar n={avatarFor(r.user_id, r.avatar)} size={34} /><div className="min-w-0"><p className="truncate font-bold">{r.display_name}</p><p className="text-xs text-white/50">{ago(r.created_at)}</p></div></div>;
}

function Medal({ i }: { i: number }) {
  const c = ['#fbbf24', '#cbd5e1', '#f59e63'][i];
  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold" style={{ background: c || 'rgba(255,255,255,.12)', color: c ? '#1a1200' : '#fff' }}>{i + 1}</span>;
}

export default function RecordsPage() {
  const [tab, setTab] = useState<Tab>('finds');
  const [rows, setRows] = useState<Partial<Record<Tab, RecordRow[]>>>({});
  const [five, setFive] = useState<{ games?: RecordRow; sweep?: RecordRow }>({});
  const [featured, setFeatured] = useState<Featured[]>([]);
  const [offline, setOffline] = useState(false);
  const [err, setErr] = useState(false);
  const [rounds, setRounds] = useState<3 | 5>(5);

  useEffect(() => {
    const c = getWikiClient();
    if (!c) { setOffline(true); return; }
    void topFinds(c, 30).then(r => { setRows(p => ({ ...p, finds: r.rows })); if (r.error) setErr(true); });
    void bestGames(c, 5, 1).then(r => setFive(p => ({ ...p, games: r.rows[0] })));
    void sweeps(c, 5, 1).then(r => setFive(p => ({ ...p, sweep: r.rows[0] })));
    fetch('/api/wikirush/featured').then(r => r.json()).then((d: { featured?: Featured[] }) => setFeatured((d.featured || []).slice().sort((a, b) => (b.day || 0) - (a.day || 0)))).catch(() => {});
  }, []);
  useEffect(() => {
    const c = getWikiClient(); if (!c) return;
    if (tab === 'pairs') void pairRecords(c, 40).then(r => setRows(p => ({ ...p, pairs: r.rows })));
    if (tab === 'games') void bestGames(c, rounds, 30).then(r => setRows(p => ({ ...p, games: r.rows })));
    if (tab === 'sweeps') void sweeps(c, rounds, 30).then(r => setRows(p => ({ ...p, sweeps: r.rows })));
  }, [tab, rounds]);

  const top = rows.finds?.[0];
  const list = rows[tab];
  return <Shell wide eyebrow="Hall of fame" title="World records" sub="Who found it fastest? Every record is tied to a real route, and anyone can take it.">
    <div className="mb-6 flex gap-2" role="tablist" aria-label="Rankings"><Link href="/leaderboard" className="gx-btn gx-btn-ghost gx-btn-sm">Players</Link><span className="gx-btn gx-btn-sm" aria-current="page">World records</span></div>

    <section aria-label="Current records" className="grid gap-3 sm:grid-cols-3">
      {[
        { k: 'Fastest find', v: top ? fmtMs(top.elapsed_ms || 0) : '–', sub: top ? `${top.start_title} → ${top.target_title}` : 'Not set yet', who: top },
        { k: 'Best 5-round score', v: five.games ? (five.games.total ?? 0).toLocaleString() : '–', sub: five.games ? `${five.games.seconds}s rounds` : 'Not set yet', who: five.games },
        { k: 'Fastest 5-round sweep', v: five.sweep ? fmtMs(five.sweep.elapsed_ms || 0) : '–', sub: five.sweep ? 'All five found' : 'Not set yet', who: five.sweep },
      ].map(c => <div key={c.k} className="gx-card relative overflow-hidden p-5">
        <p className="gx-eyebrow !text-[var(--gx-gold)]">🏆 {c.k}</p>
        <p className="mt-2 text-4xl font-bold tabular-nums">{c.v}</p>
        <p className="mt-1 truncate text-sm text-white/65">{c.sub}</p>
        {c.who && <div className="mt-3"><Who r={c.who} /></div>}
      </div>)}
    </section>

    <div role="tablist" aria-label="Record type" className="mt-8 flex gap-1.5 overflow-x-auto pb-1">
      {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === k ? 'bg-[#6978f5] text-white' : 'bg-white/[.07] text-white/70 hover:text-white'}`}>{l}</button>)}
    </div>
    {(tab === 'games' || tab === 'sweeps') && <div className="mt-3 flex gap-2">{([5, 3] as const).map(n => <button key={n} onClick={() => setRounds(n)} aria-pressed={rounds === n} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${rounds === n ? 'bg-white/20' : 'bg-white/[.06] text-white/65'}`}>{n} rounds</button>)}</div>}

    <section className="gx-card mt-4 overflow-hidden" aria-label="Records list">
      {offline ? <p className="p-8 text-white/75">World records are not connected yet.</p>
        : tab === 'challenges' ? (featured.length ? <ul>{featured.map(f => <li key={f.id} className="border-t border-white/[.07] p-5 first:border-t-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--gx-pink)]">{f.day ? `Day ${f.day} Challenge` : 'Challenge'}</p><h3 className="text-lg font-bold">{f.title}</h3><p className="text-sm text-white/60">{f.pairs[0].start} → {f.pairs[0].target}{f.pairs.length > 1 ? ` +${f.pairs.length - 1} more` : ''}</p></div>
              <div className="flex gap-2"><Link href={`/wikirush?f=${encodeURIComponent(f.id)}#feat-${f.id}`} className="gx-btn gx-btn-sm">Play</Link><ShareChallenge f={f} /></div>
            </div>
            <div className="mt-3"><ChallengeBoard featuredId={f.id} limit={5} /></div>
          </li>)}</ul> : <p className="p-8 text-white/75">No challenges are live right now.</p>)
        : !list ? <p className="p-8 text-white/70">Loading…</p>
        : err && !list.length ? <p className="p-8 text-white/75">Could not load records. Try again in a moment.</p>
        : !list.length ? <div className="p-8"><p className="text-white/80">No records here yet. Finish a game while signed in and the first one is yours.</p><Link href="/wikirush#play" className="gx-btn gx-btn-gold mt-4">Set a record</Link></div>
        : <ol>{list.map((r, i) => <li key={r.id} className="flex flex-wrap items-center gap-3 border-t border-white/[.07] px-4 py-3 first:border-t-0 sm:gap-4">
          <Medal i={i} />
          <div className="min-w-0 basis-40 flex-1"><Who r={r} /></div>
          {(tab === 'finds' || tab === 'pairs') ? <>
            <div className="min-w-0 basis-56 flex-[2]"><p className="truncate text-sm font-semibold">{r.start_title} → {r.target_title}</p><p className="truncate text-xs text-white/50">{(r.path || []).join(' → ')}</p></div>
            <div className="text-right"><p className="text-lg font-bold tabular-nums text-[var(--gx-gold)]">{fmtMs(r.elapsed_ms || 0)}</p><p className="text-xs text-white/50">{r.clicks} click{r.clicks === 1 ? '' : 's'}</p></div>
            <Link href={`/wikirush?beat=${r.id}#play`} className="gx-btn gx-btn-sm">Beat it</Link>
          </> : <div className="text-right"><p className="text-lg font-bold tabular-nums text-[var(--gx-gold)]">{tab === 'games' ? (r.total ?? 0).toLocaleString() : fmtMs(r.elapsed_ms || 0)}</p><p className="text-xs text-white/50">{r.rounds} rounds · {r.seconds}s{r.day ? ` · Day ${r.day}` : ''}</p></div>}
        </li>)}</ol>}
    </section>
    <p className="mt-4 text-xs text-white/45">Records need a signed-in player, a route that really starts and ends on the right pages, and a human pace. Fastest finds count routes of 3+ clicks.</p>
  </Shell>;
}
