'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Shell from '@/components/game/Shell';
import { Avatar, Emblem } from '@/components/game/Art';
import { getWikiClient, ensureWikiProfile, referralUrl } from '@/lib/wikirush-client';
import { LEVELS, levelFor } from '@/lib/wikirush/levels';

type Profile = { display_name: string; points: number; login_streak: number; best_streak: number; runs_played: number; referral_code: string; created_at: string };

export default function ProfilePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const client = getWikiClient();
    if (!client) { setMessage('Accounts are not set up on this site yet.'); setLoading(false); return; }
    client.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        await ensureWikiProfile(client, data.session.user);
        const { data: p, error } = await client.from('wiki_profiles').select('display_name, points, login_streak, best_streak, runs_played, referral_code, created_at').eq('user_id', data.session.user.id).maybeSingle();
        if (error) setMessage('Could not load your profile. Try again in a moment.');
        else {
          setProfile(p as Profile | null);
          const { count } = await client.from('wiki_profiles').select('user_id', { count: 'exact', head: true }).gt('points', Number(p?.points || 0));
          setRank(count === null ? null : count + 1);
        }
      }
      setLoading(false);
    });
  }, []);
  const invite = profile?.referral_code ? referralUrl(profile.referral_code) : '';
  async function copyInvite() {
    if (!invite) return;
    try { await navigator.clipboard.writeText(invite); setMessage('Invite link copied. Send it to a friend.'); } catch { setMessage(invite); }
  }

  if (loading) return <Shell eyebrow="Player card" title="Your profile"><p className="text-white/70">Loading…</p></Shell>;
  if (!session) return <Shell eyebrow="Player card" title="Your profile" sub={message || 'Sign in to see your level, points and rank.'}>
    <div className="flex flex-wrap gap-3"><Link href="/login?next=/profile" className="gx-btn gx-btn-gold">Sign in</Link><Link href="/login?mode=signup&next=/profile" className="gx-btn">Join free</Link></div>
  </Shell>;

  const points = Number(profile?.points || 0);
  const lv = levelFor(points);
  const idx = LEVELS.findIndex(l => l.name === lv.level.name);
  const avatar = Number(session.user.user_metadata?.avatar) || 1;
  const name = profile?.display_name || String(session.user.user_metadata?.display_name || 'Explorer');
  const stats: Array<[string, string]> = [['Points', points.toLocaleString()], ['Global rank', rank ? `#${rank.toLocaleString()}` : '–'], ['Day streak', `${profile?.login_streak || 0} 🔥`], ['Best streak', String(profile?.best_streak || 0)], ['Rounds played', String(profile?.runs_played || 0)]];

  return <Shell eyebrow="Player card" title={name}>
    <section className="gx-card p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-5">
        <Avatar n={avatar} size={92} className="ring-4 ring-white/20" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#aeb7ff]">Level {idx + 1} · {lv.level.name}</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{points.toLocaleString()} <span className="text-lg text-white/60">pts</span></p>
          <p className="mt-1 text-sm text-white/60">Playing since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'today'}</p>
        </div>
        <Emblem index={idx} size={96} className="gx-float" />
      </div>
      <div className="gx-bar mt-5"><i style={{ width: `${Math.max(3, Math.round(lv.progress * 100))}%` }} /></div>
      <p className="mt-2 text-sm font-semibold text-white/70">{lv.next ? `${lv.toNext.toLocaleString()} points to ${lv.next.name}` : 'You reached the top level.'}</p>
      <div className="mt-5 flex flex-wrap gap-3"><Link href="/wikirush#play" className="gx-btn">▶ Play</Link><Link href="/settings" className="gx-btn gx-btn-ghost">Edit profile</Link><Link href="/leaderboard" className="gx-btn gx-btn-ghost">Leaderboard</Link></div>
    </section>

    <section aria-label="Stats" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
      {stats.map(([l, v]) => <div key={l} className="gx-card p-4"><p className="text-xs font-bold uppercase tracking-wider text-white/55">{l}</p><p className="mt-1 text-2xl font-bold tabular-nums">{v}</p></div>)}
    </section>

    <section aria-label="Levels" className="gx-card mt-5 p-5 sm:p-7">
      <h2 className="text-lg font-bold">Level ladder</h2>
      <ol className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-7">
        {LEVELS.map((l, i) => <li key={l.name} className={`text-center ${i > idx ? 'opacity-40 grayscale' : ''}`}><Emblem index={i} size={56} className={`mx-auto ${i === idx ? 'gx-float' : ''}`} /><p className="mt-1 text-xs font-bold">{l.name}</p><p className="text-[11px] text-white/55">{l.min.toLocaleString()}+</p></li>)}
      </ol>
    </section>

    <section className="gx-card mt-5 p-5 sm:p-7">
      <h2 className="text-lg font-bold">Bring a rival, earn bonus points</h2>
      <p className="mt-1 text-sm text-white/70">When a friend joins with your link, you both get a one-time bonus.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row"><input readOnly value={invite} aria-label="Your invite link" className="gx-input min-w-0 flex-1" /><button onClick={copyInvite} className="gx-btn gx-btn-gold">Copy link</button></div>
      {message && <p role="status" className="mt-3 break-words text-sm text-white/70">{message}</p>}
    </section>
  </Shell>;
}
