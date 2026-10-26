'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAccount } from '@/lib/account';
import { getWikiClient } from '@/lib/wikirush-client';
import { LEVELS, levelFor } from '@/lib/wikirush/levels';
import { loadStats } from '@/lib/wikirush/stats';
import { Avatar, Emblem } from './Art';

/** Home-screen player card: level, points, rank. Guests see what signing in would save. */
export default function PlayerCard() {
  const a = useAccount();
  const [rank, setRank] = useState<number | null>(null);
  const [device, setDevice] = useState(0);
  useEffect(() => { try { setDevice(Math.floor(loadStats().totalScore / 10)); } catch { /* ignore */ } }, []);
  useEffect(() => {
    const c = getWikiClient();
    if (!c || !a.signedIn) return;
    void c.from('wiki_profiles').select('user_id', { count: 'exact', head: true }).gt('points', a.points).then(({ count }) => setRank(count === null ? null : count + 1));
  }, [a.signedIn, a.points]);

  if (!a.ready) return <div className="gx-card h-44 w-full animate-pulse" aria-hidden="true" />;

  if (!a.signedIn) {
    return <div className="gx-card w-full p-5">
      <div className="flex items-center gap-4">
        <Emblem index={0} size={56} />
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight">Save your progress</p>
          <p className="mt-0.5 text-sm text-white/65">{device > 0 ? `You have ${device.toLocaleString()} points on this device.` : 'Earn points, level up, join the leaderboard.'}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/login?mode=signup" className="gx-btn gx-btn-gold">Join free</Link>
        <Link href="/login" className="gx-btn gx-btn-ghost">Sign in</Link>
      </div>
    </div>;
  }
  const lv = levelFor(a.points);
  const idx = LEVELS.findIndex(l => l.name === lv.level.name);
  return <Link href="/profile" className="gx-card block w-full p-5 no-underline text-white transition hover:bg-white/10">
    <div className="flex items-center gap-4">
      <Avatar n={a.avatar} size={60} className="ring-2 ring-white/25" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold leading-tight">{a.name}</p>
        <p className="text-sm font-semibold text-[#aeb7ff]">Level {idx + 1} · {lv.level.name}</p>
      </div>
      <Emblem index={idx} size={52} />
    </div>
    <div className="gx-bar mt-4"><i style={{ width: `${Math.max(4, Math.round(lv.progress * 100))}%` }} /></div>
    <div className="mt-2 flex items-center justify-between text-xs font-semibold text-white/70">
      <span>{a.points.toLocaleString()} pts</span>
      <span>{lv.next ? `${lv.toNext.toLocaleString()} to ${lv.next.name}` : 'Max level'}</span>
      {rank && <span className="text-[var(--gx-gold)]">Rank #{rank.toLocaleString()}</span>}
    </div>
  </Link>;
}
