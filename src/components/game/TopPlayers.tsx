'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getWikiClient } from '@/lib/wikirush-client';
import { avatarFor, loadTop, type PlayerRow } from '@/lib/players';
import { Avatar } from './Art';

const MEDAL = ['#fbbf24', '#cbd5e1', '#f59e63'];

/** Top five players, for the home screen. */
export default function TopPlayers({ limit = 5 }: { limit?: number }) {
  const [rows, setRows] = useState<PlayerRow[] | null>(null);
  useEffect(() => {
    const c = getWikiClient();
    if (!c) { setRows([]); return; }
    void loadTop(c, limit).then(r => setRows(r.rows));
  }, [limit]);
  return <div className="gx-card p-5">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-bold">Top explorers</h3>
      <Link href="/leaderboard" className="text-sm font-bold text-[#aeb7ff] no-underline hover:text-white">See all →</Link>
    </div>
    {rows === null ? <div className="mt-4 space-y-2">{[0, 1, 2, 3, 4].slice(0, limit).map(i => <div key={i} className="h-11 animate-pulse rounded-xl bg-white/5" />)}</div>
      : rows.length === 0 ? <p className="mt-4 text-sm text-white/65">The board is empty. Finish a game and be number one.</p>
      : <ol className="mt-3 space-y-1.5">{rows.map((p, i) => <li key={p.user_id} className="flex items-center gap-3 rounded-xl bg-white/[.05] px-3 py-2">
        <span className="grid h-7 w-7 place-items-center rounded-full text-sm font-bold text-[#1a1200]" style={{ background: MEDAL[i] || 'rgba(255,255,255,.14)', color: MEDAL[i] ? '#1a1200' : '#fff' }}>{i + 1}</span>
        <Avatar n={avatarFor(p.user_id, p.avatar)} size={30} />
        <span className="min-w-0 flex-1 truncate font-semibold">{p.display_name}</span>
        <span className="text-sm font-bold tabular-nums text-[var(--gx-gold)]">{Number(p.points || 0).toLocaleString()}</span>
      </li>)}</ol>}
  </div>;
}
