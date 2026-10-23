'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

type Props = {
  supabase: SupabaseClient | null;
  session: Session | null;
  referralCode: string;
  setReferralCode(code: string): void;
  startInSignup: boolean;
  onSession(session: Session | null, notice?: string): void;
};

export default function AuthPanel({ supabase, session, referralCode, setReferralCode, startInSignup, onSession }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [signup, setSignup] = useState(startInSignup);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    if (!supabase) { setError('Accounts are not configured on this deployment yet. You can still play; scores stay on this device.'); return; }
    setBusy(true);
    try {
      if (signup) {
        const { data, error: err } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName.trim(), referral_code: referralCode.trim().toLowerCase() || undefined } } });
        if (err) setError(err.message);
        else if (data.session) onSession(data.session, 'Account created. Your explorer profile is ready.');
        else setError('Account created, but email confirmation is still required in Supabase. Turn off “Confirm email” to enable instant sign-up.');
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) setError(err.message); else onSession(data.session, 'Welcome back. Ready to chase a page?');
      }
    } finally { setBusy(false); }
  }

  if (session) {
    const name = String(session.user.user_metadata?.display_name || session.user.email || 'Explorer');
    return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
      <div>
        <p className="font-extrabold">Playing as {name}</p>
        <p className="text-xs text-slate-500">Finished games sync to the Duelio leaderboard.</p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm font-bold">
          <Link href="/profile" className="underline">Profile</Link><Link href="/settings" className="underline">Settings</Link><Link href="/leaderboard" className="underline">Leaderboard</Link>
        </div>
      </div>
      <button onClick={async () => { await supabase?.auth.signOut(); onSession(null); }} className="text-sm font-bold underline">Sign out</button>
    </div>;
  }

  return <div className="rounded-2xl border border-slate-200 p-5">
    <h3 className="text-lg font-black">Put your name on the board</h3>
    <p className="mt-1 text-sm text-slate-500">Free account, no email confirmation. Your Daily score and points go on the public leaderboard.</p>
    <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
      {signup && <label className="text-sm font-bold sm:col-span-2">Display name<input required maxLength={24} value={displayName} onChange={e => setDisplayName(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3 font-normal" placeholder="Trailblazer" /></label>}
      <label className="text-sm font-bold sm:col-span-2">Email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3 font-normal" placeholder="you@example.com" /></label>
      <label className="text-sm font-bold sm:col-span-2">Password<input required minLength={8} type="password" autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3 font-normal" placeholder="At least 8 characters" /></label>
      {signup && <label className="text-sm font-bold sm:col-span-2">Referral code <span className="font-normal text-slate-400">(optional)</span><input value={referralCode} onChange={e => setReferralCode(e.target.value)} maxLength={40} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3 font-normal" placeholder="A friend's code" /></label>}
      <button disabled={busy} className="min-h-11 rounded-xl bg-[#6978f5] px-4 font-extrabold text-white disabled:opacity-60">{signup ? 'Create account' : 'Sign in'}</button>
      <button type="button" onClick={() => setSignup(v => !v)} className="min-h-11 rounded-xl border border-slate-200 px-4 font-bold">{signup ? 'I already have an account' : 'New here? Sign up'}</button>
    </form>
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
  </div>;
}
