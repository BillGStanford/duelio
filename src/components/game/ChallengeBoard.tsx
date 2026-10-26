'use client';

import { useEffect, useState } from 'react';
import { getWikiClient } from '@/lib/wikirush-client';
import { challengeBoard } from '@/lib/recordsClient';
import { avatarFor } from '@/lib/players';
import type { RecordRow } from '@/lib/wikirush/records';
import { Avatar } from './Art';

/** Top scores on one Day N Challenge. */
export default function ChallengeBoard({ featuredId, limit = 3 }: { featuredId: string; limit?: number }) {
  const [rows, setRows] = useState<RecordRow[] | null>(null);
  useEffect(() => {
    const c = getWikiClient();
    if (!c) { setRows([]); return; }
    let live = true;
    void challengeBoard(c, featuredId, limit).then(r => { if (live) setRows(r.rows); });
    return () => { live = false; };
  }, [featuredId, limit]);
  if (rows === null) return <div className="h-14 animate-pulse rounded-xl bg-white/5" aria-hidden="true" />;
  if (!rows.length) return <p className="rounded-xl bg-white/[.06] px-3 py-2.5 text-sm text-white/65">No scores yet. Be the first on the board.</p>;
  return <ol className="space-y-1.5" aria-label="Top scores">
    {rows.map((r, i) => <li key={r.id} className="flex items-center gap-2.5 rounded-xl bg-white/[.06] px-3 py-1.5 text-sm">
      <span className="w-5 text-center font-bold text-white/55">{i + 1}</span>
      <Avatar n={avatarFor(r.user_id, r.avatar)} size={24} />
      <span className="min-w-0 flex-1 truncate font-semibold">{r.display_name}</span>
      <span className="font-bold tabular-nums text-[var(--gx-gold)]">{(r.total ?? 0).toLocaleString()}</span>
    </li>)}
  </ol>;
}
