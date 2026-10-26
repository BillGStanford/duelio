'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Shell from '@/components/game/Shell';
import { Avatar, Emblem } from '@/components/game/Art';
import { getWikiClient } from '@/lib/wikirush-client';
import { avatarFor, loadTop, type PlayerRow } from '@/lib/players';
import { LEVELS, levelFor } from '@/lib/wikirush/levels';
import { loadStats } from '@/lib/wikirush/stats';

const idxOf = (pts: number) => LEVELS.findIndex(l => l.name === levelFor(pts).level.name);

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [me, setMe] = useState<{ id: string; points: number; rank: number | null } | null>(null);
  const [device, setDevice] = useState(0);
  useEffect(() => {
    const client = getWikiClient();
    if (!client) { setMessage('The leaderboard is not connected yet.'); setLoading(false); return; }
    client.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) return;
      const { data: row } = await client.from('wiki_profiles').select('points').eq('user_id', uid).maybeSingle();
      const pts = Number(row?.points || 0);
      const { count } = await client.from('wiki_profiles').select('user_id', { count: 'exact', head: true }).gt('points', pts);
      setMe({ id: uid, points: pts, rank: count === null ? null : count + 1 });
    });
    try { setDevice(Math.floor(loadStats().totalScore / 10) || 0); } catch { /* ignore */ }
    void loadTop(client, 100).then(r => { if (r.error) setMessage('Could not load the leaderboard. Try again in a moment.'); else setPlayers(r.rows); setLoading(false); });
  }, []);

  const top3 = players.slice(0, 3);
  const order = [1, 0, 2].filter(i => top3[i]); // 2nd, 1st, 3rd
  const heights = ['h-28', 'h-36', 'h-24'];
  const medal = ['#cbd5e1', '#fbbf24', '#f59e63'];

  return <Shell wide eyebrow="Global standings" title="Leaderboard" sub="Every finished game earns points. Climb the board and level up.">
    <div className="flex flex-wrap items-center gap-3">
      <Link href="/wikirush?play=1" className="gx-btn gx-btn-lg !min-h-[3.4rem] !text-xl">▶ Play to climb</Link>
      {me ? <div className="gx-card flex items-center gap-3 px-4 py-2.5"><Emblem index={idxOf(me.points)} size={34} /><p className="font-bold">You: <span className="text-[var(--gx-gold)]">{me.points.toLocaleString()} pts</span>{me.rank ? ` · #${me.rank.toLocaleString()}` : ''}</p></div>
        : device > 0 ? <p className="gx-card px-4 py-2.5 text-sm font-semibold">{device.toLocaleString()} pts on this device. <Link href="/login?mode=signup&next=/leaderboard" className="text-[var(--gx-gold)] underline">Join free</Link> to put them on the board.</p> : null}
    </div>

    {!loading && !message && order.length > 0 && <div className="mt-10 flex items-end justify-center gap-3 sm:gap-6" aria-label="Top three">
      {order.map(i => { const p = top3[i]; return <div key={p.user_id} className="w-[30%] max-w-[190px] text-center">
        <Avatar n={avatarFor(p.user_id, p.avatar)} size={i === 0 ? 76 : 60} className="mx-auto ring-4" />
        <p className="mt-2 truncate font-bold">{p.display_name}</p>
        <p className="text-sm font-bold tabular-nums text-[var(--gx-gold)]">{Number(p.points || 0).toLocaleString()}</p>
        <div className={`mt-2 grid place-items-start rounded-t-2xl pt-3 text-3xl font-bold text-[#1a1200] ${heights[i]}`} style={{ background: medal[i] }}>{i + 1}</div>
      </div>; })}
    </div>}

    <section className="gx-card mt-8 overflow-hidden" aria-label="All players">
      {loading ? <p className="p-8 text-white/70">Loading standings…</p>
        : message ? <p role="status" className="p-8 text-white/80">{message}</p>
        : players.length === 0 ? <p className="p-8 text-white/80">No one is on the board yet. Finish a game and take the first spot.</p>
        : <ol>{players.map((p, i) => { const mine = me?.id === p.user_id; return <li key={p.user_id} data-me={mine ? '1' : undefined} className={`flex items-center gap-3 border-t border-white/[.07] px-4 py-3 first:border-t-0 sm:gap-4 ${mine ? 'bg-[#6978f5]/25' : ''}`}>
          <span className="w-8 text-center text-lg font-bold text-white/50">{i + 1}</span>
          <Avatar n={avatarFor(p.user_id, p.avatar)} size={40} />
          <div className="min-w-0 flex-1"><p className="truncate font-bold">{p.display_name}{mine && <span className="ml-2 rounded-full bg-[#fbbf24] px-2 py-0.5 text-[10px] font-bold uppercase text-[#1a1200]">You</span>}</p><p className="text-xs text-white/55">{LEVELS[idxOf(Number(p.points || 0))].name} · {p.runs_played || 0} rounds</p></div>
          <span className="hidden text-sm font-semibold text-white/65 sm:block">{p.login_streak || 0} 🔥</span>
          <Emblem index={idxOf(Number(p.points || 0))} size={30} />
          <span className="w-20 text-right font-bold tabular-nums text-[var(--gx-gold)]">{Number(p.points || 0).toLocaleString()}</span>
        </li>; })}</ol>}
    </section>
    <p className="mt-4 text-xs text-white/45">Only display names, avatars and game stats are public. Emails are never shown.</p>
  </Shell>;
}
