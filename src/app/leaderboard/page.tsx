'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getWikiClient } from '@/lib/wikirush-client';

type Player = { user_id: string; display_name: string; points: number; login_streak: number; best_streak: number; runs_played: number; created_at: string };

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const client = getWikiClient();
    if (!client) { setMessage('Leaderboard data is not connected yet. The database migration and public Supabase browser key must be configured.'); setLoading(false); return; }
    client.from('wiki_profiles').select('user_id, display_name, points, login_streak, best_streak, runs_played, created_at').order('points', { ascending: false }).order('runs_played', { ascending: true }).limit(100)
      .then(({ data, error }) => { if (error) setMessage('Could not load the leaderboard. Run the WikiRush database migration and try again.'); else setPlayers((data || []) as Player[]); setLoading(false); });
  }, []);
  return <main className="mx-auto max-w-5xl px-5 py-12">
    <p className="text-xs font-black uppercase tracking-[.18em] text-[#5968ec]">WikiRush · Global standings</p>
    <div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-4xl font-black tracking-tight sm:text-6xl">The leaderboard.</h1><p className="mt-3 max-w-2xl text-slate-600">Every finished trail counts. Build your score, keep your sign-in streak alive, and earn your place among the fastest explorers.</p></div><Link href="/wikirush" className="rounded-xl bg-[#6978f5] px-5 py-3 font-extrabold text-white">Play a run →</Link></div>
    <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="grid grid-cols-[54px_minmax(0,1fr)_90px] gap-3 bg-[#101426] px-4 py-4 text-xs font-black uppercase tracking-wider text-white/70 sm:grid-cols-[70px_minmax(0,1fr)_110px_100px_100px]"><span>Rank</span><span>Explorer</span><span className="text-right">Points</span><span className="hidden text-right sm:block">Day streak</span><span className="hidden text-right sm:block">Runs</span></div>
      {loading ? <p className="p-8 text-slate-500">Loading standings…</p> : message ? <p role="status" className="p-8 text-slate-600">{message}</p> : players.length ? players.map((p, i) => <div key={p.user_id} className="grid grid-cols-[54px_minmax(0,1fr)_90px] items-center gap-3 border-t border-slate-100 px-4 py-4 sm:grid-cols-[70px_minmax(0,1fr)_110px_100px_100px]"><span className="text-lg font-black text-slate-400">{String(i + 1).padStart(2, '0')}</span><div className="min-w-0"><p className="truncate font-extrabold">{p.display_name}</p><p className="text-xs text-slate-500">WikiRush explorer</p></div><span className="text-right font-black tabular-nums">{Number(p.points || 0).toLocaleString()}</span><span className="hidden text-right font-bold sm:block">{p.login_streak || 0} 🔥</span><span className="hidden text-right text-slate-600 sm:block">{p.runs_played || 0}</span></div>) : <p className="p-8 text-slate-600">No explorers on the board yet. Be the first to finish a trail.</p>}
    </section>
    <p className="mt-4 text-xs leading-relaxed text-slate-500">Only display names and game statistics are public; email addresses are never shown.</p>
  </main>;
}
