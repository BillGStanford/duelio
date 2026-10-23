'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getWikiClient, ensureWikiProfile, referralUrl } from '@/lib/wikirush-client';

type Profile = { display_name: string; points: number; login_streak: number; best_streak: number; runs_played: number; referral_code: string; created_at: string };
export default function ProfilePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const client = getWikiClient();
    if (!client) { setMessage('Account service is not configured for this deployment yet.'); setLoading(false); return; }
    client.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        await ensureWikiProfile(client, data.session.user);
        const { data: p, error } = await client.from('wiki_profiles').select('display_name, points, login_streak, best_streak, runs_played, referral_code, created_at').eq('user_id', data.session.user.id).maybeSingle();
        if (error) setMessage('Could not load your profile. Run the WikiRush database migration.');
        else setProfile(p as Profile | null);
      }
      setLoading(false);
    });
  }, []);
  const invite = profile?.referral_code ? referralUrl(profile.referral_code) : '';
  async function copyInvite() {
    if (!invite) return;
    try { await navigator.clipboard.writeText(invite); setMessage('Invite link copied. Share it with a friend.'); }
    catch { setMessage(invite); }
  }
  if (loading) return <main className="mx-auto max-w-4xl px-5 py-16 text-slate-500">Loading your profile…</main>;
  if (!session) return <main className="mx-auto max-w-4xl px-5 py-16"><p className="text-xs font-black uppercase tracking-widest text-[#6978f5]">Explorer profile</p><h1 className="mt-3 text-4xl font-black">Your name belongs on the board.</h1><p className="mt-3 text-slate-600">{message || 'Create an account or sign in from WikiRush to view your profile, stats, and referral link.'}</p><Link href="/wikirush" className="mt-6 inline-flex rounded-xl bg-[#6978f5] px-5 py-3 font-extrabold text-white">Sign in or create account →</Link></main>;
  return <main className="mx-auto max-w-4xl px-5 py-12"><p className="text-xs font-black uppercase tracking-[.18em] text-[#6978f5]">Your explorer card</p><div className="mt-4 rounded-3xl bg-[#101426] p-7 text-white sm:p-10"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold text-white/55">DUELIO / WIKIRUSH</p><h1 className="mt-3 text-4xl font-black sm:text-6xl">{profile?.display_name || session.user.user_metadata?.display_name || 'Trailblazer'}</h1><p className="mt-2 text-white/65">Explorer since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'today'}</p></div><Link href="/settings" className="rounded-xl border border-white/20 px-4 py-3 font-bold hover:bg-white/10">Edit profile ⚙</Link></div><div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Points', Number(profile?.points || 0).toLocaleString()],['Day streak', String(profile?.login_streak || 0)],['Best streak', String(profile?.best_streak || 0)],['Runs played', String(profile?.runs_played || 0)]].map(([label,value])=><div key={label} className="rounded-2xl bg-white/10 p-4"><p className="text-xs font-bold text-white/55">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}</div></div><section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6"><h2 className="text-2xl font-black">Bring a rival. Earn a bonus.</h2><p className="mt-2 text-slate-600">Invite a friend with your personal link. When a new player creates an account through it, both of you receive a one-time referral bonus.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input readOnly value={invite} aria-label="Your referral link" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"/><button onClick={copyInvite} className="rounded-xl bg-[#6978f5] px-5 py-3 font-extrabold text-white">Copy invite link ↗</button></div>{message && <p role="status" className="mt-3 break-words text-sm text-slate-600">{message}</p>}</section><Link href="/leaderboard" className="mt-6 inline-flex font-extrabold underline">View public leaderboard →</Link></main>;
}
