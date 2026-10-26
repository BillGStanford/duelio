'use client';

import Link from 'next/link';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

type Props = {
  /** Streamer mode: never show email or account details on screen. */
  stream?: boolean;
  supabase: SupabaseClient | null;
  session: Session | null;
  referralCode: string;
  setReferralCode(code: string): void;
  startInSignup: boolean;
  onSession(session: Session | null, notice?: string): void;
};

export default function AuthPanel({ stream, supabase, session, referralCode, startInSignup, onSession }: Props) {
  if (session) {
    const name = stream ? 'Streamer' : String(session.user.user_metadata?.display_name || session.user.email || 'Explorer');
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

  const q = new URLSearchParams({ next: '/wikirush', ...(referralCode ? { ref: referralCode } : {}), ...(startInSignup ? { mode: 'signup' } : {}) });
  return <div className="overflow-hidden rounded-3xl bg-[#0e1330] p-6 text-white">
    <p className="text-xs font-bold uppercase tracking-[.18em] text-[#aeb7ff]">Your name on the board</p>
    <h3 className="mt-2 text-2xl font-bold">Save your points and level up</h3>
    <p className="mt-1 text-sm text-white/70">A free account puts your Daily score and points on the public leaderboard.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <Link href={`/login?mode=signup&${q}`} className="gx-btn gx-btn-gold">Join free</Link>
      <Link href={`/login?${q}`} className="gx-btn gx-btn-ghost">Sign in</Link>
    </div>
  </div>;
}
