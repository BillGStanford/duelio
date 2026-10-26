'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AVATAR_COUNT, avatarSrc, useAccount } from '@/lib/account';
import { ensureWikiProfile, getWikiClient } from '@/lib/wikirush-client';
import { Avatar, Pip } from './Art';

function nice(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'That email and password do not match. Try again, or create an account.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'That email already has an account. Switch to Sign in.';
  if (m.includes('password should be')) return 'Choose a password with at least 8 characters.';
  if (m.includes('rate limit')) return 'Too many tries. Wait a minute and try again.';
  return msg;
}

/** Full-screen sign-in / sign-up, styled like a game title screen. */
export default function AuthScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const acct = useAccount();
  const rawNext = params.get('next') || '/';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
  const [mode, setMode] = useState<'in' | 'up'>(params.get('mode') === 'signup' ? 'up' : 'in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(1);
  const [ref, setRef] = useState(params.get('ref') || '');
  const [showRef, setShowRef] = useState(!!params.get('ref'));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setAvatar(1 + Math.floor(Math.random() * AVATAR_COUNT)); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    const client = getWikiClient();
    if (!client) { setError('Accounts are not set up on this site yet. You can still play; scores stay on this device.'); return; }
    setBusy(true);
    try {
      if (mode === 'up') {
        const { data, error: err } = await client.auth.signUp({ email, password, options: { data: { display_name: name.trim(), avatar, referral_code: ref.trim().toLowerCase() || undefined } } });
        if (err) { setError(nice(err.message)); return; }
        if (!data.session) { setError('Almost there: check your email to confirm your account, then sign in.'); setMode('in'); return; }
        await ensureWikiProfile(client, data.session.user);
        await client.from('wiki_profiles').update({ avatar }).eq('user_id', data.session.user.id); // optional column
      } else {
        const { error: err } = await client.auth.signInWithPassword({ email, password });
        if (err) { setError(nice(err.message)); return; }
      }
      router.push(next);
      router.refresh();
    } finally { setBusy(false); }
  }

  async function signOut() { await getWikiClient()?.auth.signOut(); }

  return <main className="gx-screen min-h-[calc(100vh-58px)]">
    <picture>
      <source media="(min-width: 900px)" srcSet="/game/hero.jpg" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/game/auth.jpg" alt="" className="gx-stars h-full w-full object-cover" />
    </picture>
    <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_45%,rgba(11,15,31,.35),rgba(11,15,31,.85))]" />
    <div className="mx-auto flex min-h-[calc(100vh-58px)] max-w-md flex-col justify-center px-4 pb-10 pt-28">
      <div className="relative gx-rise">
        <div className="pointer-events-none absolute -top-[74px] left-1/2 z-10 -translate-x-1/2"><Pip size={96} float /></div>
        <div className="gx-card !bg-[#0e1330]/85 p-6 pt-14 sm:p-8 sm:pt-14">
          {acct.signedIn ? <div className="text-center">
            <Avatar n={acct.avatar} size={72} className="mx-auto ring-2 ring-white/25" />
            <h1 className="gx-h mt-3 text-3xl">Hi, {acct.name}!</h1>
            <p className="mt-1 text-sm text-white/65">You are signed in. Your points save automatically.</p>
            <div className="mt-6 grid gap-3">
              <Link href="/wikirush#play" className="gx-btn gx-btn-lg !text-xl">▶ PLAY</Link>
              <Link href="/profile" className="gx-btn gx-btn-ghost">My profile</Link>
              <button type="button" onClick={signOut} className="text-sm font-semibold text-white/60 hover:text-white">Sign out</button>
            </div>
          </div> : <>
            <h1 className="gx-h text-center text-3xl">{mode === 'up' ? 'Create your player' : 'Welcome back'}</h1>
            <p className="mt-1 text-center text-sm text-white/65">{mode === 'up' ? 'Free. Save points, level up and join the leaderboard.' : 'Sign in to keep your points and level.'}</p>
            <div role="tablist" aria-label="Sign in or sign up" className="mt-5 grid grid-cols-2 rounded-2xl bg-white/[.07] p-1">
              {([['in', 'Sign in'], ['up', 'New player']] as const).map(([k, l]) => <button key={k} role="tab" type="button" aria-selected={mode === k} onClick={() => { setMode(k); setError(''); }} className={`rounded-xl px-3 py-2.5 text-sm font-bold transition ${mode === k ? 'bg-[#6978f5] text-white shadow' : 'text-white/65 hover:text-white'}`}>{l}</button>)}
            </div>
            <form onSubmit={submit} className="mt-5 space-y-4">
              {mode === 'up' && <>
                <fieldset>
                  <legend className="gx-label">Pick your avatar</legend>
                  <div className="grid grid-cols-6 gap-2">
                    {Array.from({ length: AVATAR_COUNT }, (_, i) => i + 1).map(n => <button key={n} type="button" onClick={() => setAvatar(n)} aria-label={`Avatar ${n}`} aria-pressed={avatar === n} className={`rounded-full p-0.5 transition ${avatar === n ? 'bg-[#fbbf24] scale-110' : 'bg-transparent opacity-80 hover:opacity-100'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={avatarSrc(n)} alt="" width={44} height={44} className="h-full w-full rounded-full" />
                    </button>)}
                  </div>
                </fieldset>
                <div><label htmlFor="a-name" className="gx-label">Player name</label><input id="a-name" required maxLength={24} value={name} onChange={e => setName(e.target.value)} className="gx-input" placeholder="Trailblazer" autoComplete="nickname" /></div>
              </>}
              <div><label htmlFor="a-email" className="gx-label">Email</label><input id="a-email" required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="gx-input" placeholder="you@example.com" /></div>
              <div><label htmlFor="a-pass" className="gx-label">Password</label><input id="a-pass" required minLength={8} type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} className="gx-input" placeholder="At least 8 characters" /></div>
              {mode === 'up' && (showRef
                ? <div><label htmlFor="a-ref" className="gx-label">Friend code</label><input id="a-ref" value={ref} onChange={e => setRef(e.target.value)} maxLength={40} className="gx-input" placeholder="Optional" /></div>
                : <button type="button" onClick={() => setShowRef(true)} className="text-sm font-semibold text-[#aeb7ff] hover:text-white">Have a friend’s code? +100 bonus points</button>)}
              {error && <p role="alert" className="rounded-xl bg-rose-500/15 p-3 text-sm font-semibold text-rose-200">{error}</p>}
              <button disabled={busy} className="gx-btn gx-btn-gold w-full !text-lg">{busy ? 'One moment…' : mode === 'up' ? 'Create account' : 'Sign in'}</button>
            </form>
            <p className="mt-5 text-center text-sm text-white/55">Just want to look? <Link href="/wikirush#play" className="font-bold text-white underline">Play one free game</Link></p>
          </>}
        </div>
      </div>
    </div>
  </main>;
}
