'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getWikiClient } from '@/lib/wikirush-client';
import { levelFor } from '@/lib/wikirush/levels';

/** Your points, level and global rank, read live from the leaderboard table. */
export default function PointsCard() {
  const [state, setState] = useState<{ points: number; rank: number | null; runs: number } | null | 'none'>(null);
  useEffect(() => {
    const client = getWikiClient();
    if (!client) { setState('none'); return; }
    client.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) { setState('none'); return; }
      const { data: row } = await client.from('wiki_profiles').select('points, runs_played').eq('user_id', uid).maybeSingle();
      const points = Number(row?.points || 0);
      const { count } = await client.from('wiki_profiles').select('user_id', { count: 'exact', head: true }).gt('points', points);
      setState({ points, rank: count === null ? null : count + 1, runs: Number(row?.runs_played || 0) });
    }).catch(() => setState('none'));
  }, []);
  if (state === null || state === 'none') return null;
  const lv = levelFor(state.points);
  return <section aria-label="Your points" className="mt-6 rounded-3xl bg-[#101426] p-6 text-white">
    <p className="text-xs font-black uppercase tracking-widest text-[#aeb7ff]">Your WikiRush points</p>
    <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
      <p className="text-5xl font-black tabular-nums">{state.points.toLocaleString()}</p>
      <div className="text-right"><p className="text-lg font-black">{lv.level.icon} {lv.level.name}</p>{state.rank && <p className="text-sm font-bold text-white/65">Global rank #{state.rank.toLocaleString()}</p>}</div>
    </div>
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#6978f5] to-[#e75d87]" style={{ width: `${Math.round(lv.progress * 100)}%` }} /></div>
    <p className="mt-2 text-xs text-white/60">{lv.next ? `${lv.toNext.toLocaleString()} points to ${lv.next.name}` : 'Top level reached'} · {state.runs.toLocaleString()} rounds played</p>
    <Link href="/leaderboard" className="mt-3 inline-flex text-sm font-bold underline">See the leaderboard →</Link>
  </section>;
}
