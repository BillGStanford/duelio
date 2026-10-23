"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { ensureWikiProfile } from '@/lib/wikirush-client';

type Article = { title: string; extract?: string; pageid?: number; thumbnail?: { source: string } };
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const timers = [30, 60, 120];

export default function WikiRush() {
  const supabase = useMemo<SupabaseClient | null>(() => URL && KEY ? createClient(URL, KEY) : null, []);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [signup, setSignup] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [duration, setDuration] = useState(60);
  const [seconds, setSeconds] = useState(60);
  const [start, setStart] = useState<Article | null>(null);
  const [target, setTarget] = useState<Article | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [links, setLinks] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle'|'playing'|'won'|'lost'>('idle');
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [runs, setRuns] = useState(0);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) { setReferralCode(ref.slice(0, 40)); setSignup(true); }
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!session?.user || !supabase) return;
    let active = true;
    (async () => {
      await ensureWikiProfile(supabase, session.user);
      const { data } = await supabase.from('wiki_profiles').select('points, login_streak, runs_played').eq('user_id', session.user.id).maybeSingle();
      if (active && data) { setPoints(Number(data.points || 0)); setStreak(data.login_streak || 0); setRuns(data.runs_played || 0); }
      const code = referralCode || String(session.user.user_metadata?.referral_code || '');
      if (code) {
        const { data: claimed, error: referralError } = await supabase.rpc('claim_wikirush_referral', { p_referral_code: code });
        if (active && claimed) setNotice('Referral bonus claimed! You and your friend earned 100 points each.');
        else if (active && referralError) setNotice('Account ready. Referral bonus could not be applied; check the database setup.');
        setReferralCode('');
      }
    })();
    return () => { active = false; };
  }, [session, supabase]);

  useEffect(() => {
    if (status !== 'playing' || !startedAt) return;
    const tick = () => {
      const left = Math.max(0, duration - Math.floor((Date.now() - startedAt) / 1000));
      setSeconds(left);
      if (left === 0) { setStatus('lost'); setNotice('Time is up. The trail went cold — start another run.'); }
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [status, startedAt, duration]);

  const randomArticle = useCallback(async (): Promise<Article> => {
    const res = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary');
    if (!res.ok) throw new Error('Wikipedia is having trouble. Try again in a moment.');
    const data = await res.json();
    return { title: data.title, extract: data.extract, pageid: data.pageid, thumbnail: data.thumbnail };
  }, []);

  const loadLinks = useCallback(async (title: string) => {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.search = new URLSearchParams({ action: 'query', prop: 'links', titles: title, plnamespace: '0', pllimit: '100', format: 'json', origin: '*' }).toString();
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('Could not load article links.');
    const data = await res.json();
    const pages = Object.values(data.query?.pages || {}) as Array<{ links?: Array<{ title: string }> }>;
    setLinks((pages[0]?.links || []).map(link => link.title).filter(Boolean));
  }, []);

  async function begin() {
    setBusy(true); setError(''); setNotice(''); setHistory([]);
    try {
      const a = await randomArticle();
      let b: Article | null = null;
      for (let i = 0; i < 6; i++) { const candidate = await randomArticle(); if (candidate.title !== a.title) { b = candidate; break; } }
      if (!b) throw new Error('Could not build a trail. Try again.');
      setStart(a); setTarget(b); setArticle(a); await loadLinks(a.title);
      setSeconds(duration); setStartedAt(Date.now()); setStatus('playing');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start a run.'); }
    finally { setBusy(false); }
  }

  async function openLinked(title: string) {
    if (status !== 'playing' || !target || busy) return;
    const normalized = title.replaceAll('_', ' ').trim().toLocaleLowerCase();
    const destination = target.title.replaceAll('_', ' ').trim().toLocaleLowerCase();
    if (normalized === destination) {
      const elapsed = startedAt ? Math.max(0, (Date.now() - startedAt) / 1000) : duration;
      if (elapsed > duration) { setStatus('lost'); return; }
      const earned = Math.max(25, Math.round(100 + (duration - elapsed) * 3));
      setStatus('won'); setSeconds(Math.max(0, Math.ceil(duration - elapsed)));
      setHistory(v => [...v, target.title]);
      setNotice(`Trail complete! +${earned} points. The destination was detected: ${target.title} (${elapsed.toFixed(1)} seconds).`);
      if (supabase && session?.user) {
        const { error: saveError } = await supabase.rpc('finish_wikirush_run', { p_points: earned, p_elapsed_ms: Math.max(1000, Math.round(elapsed * 1000)), p_duration_seconds: duration, p_start_title: start?.title, p_target_title: target.title });
        if (saveError) setNotice(`Trail complete! Score could not sync: ${saveError.message}`);
        else {
          const { data } = await supabase.from('wiki_profiles').select('points, login_streak, runs_played').eq('user_id', session.user.id).maybeSingle();
          if (data) { setPoints(Number(data.points || 0)); setStreak(data.login_streak || 0); setRuns(data.runs_played || 0); }
        }
      } else setNotice('Trail complete! Create an account to save points and appear on the public leaderboard.');
      return;
    }
    setBusy(true); setError('');
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ', '_'))}`);
      if (!res.ok) { setError('That article could not be loaded. Pick another link.'); return; }
      const d = await res.json();
      const next = { title: d.title || title, extract: d.extract, pageid: d.pageid, thumbnail: d.thumbnail };
      setArticle(next); setHistory(v => [...v, next.title]); await loadLinks(next.title);
    } catch { setError('Article links could not load. Check your connection and try another link.'); }
    finally { setBusy(false); }
  }

  async function auth(e: FormEvent) {
    e.preventDefault(); setError(''); setNotice('');
    if (!supabase) { setError('Account service is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the deployment environment, then redeploy.'); return; }
    if (signup) {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName.trim(), referral_code: referralCode.trim().toLowerCase() || undefined } } });
      if (error) setError(error.message);
      else if (data.session) { setSession(data.session); setNotice('Account created. Your explorer profile is ready.'); }
      else setNotice('Account created, but Supabase still requires email confirmation. Turn off Confirm email in Supabase Authentication settings to enable instant signup.');
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message); else { setSession(data.session); setNotice('Welcome back. Ready to chase a page?'); }
    }
  }

  async function signOut() { await supabase?.auth.signOut(); setSession(null); setStatus('idle'); }
  const fullscreen = status === 'playing' && Boolean(article && start && target);

  return <main className="min-h-[80vh] bg-[#f6f7fb] pb-16">
    <section className="overflow-hidden bg-[#101426] text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:py-16 lg:grid-cols-[1fr_330px] lg:items-end">
        <div><p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[.18em] text-[#aeb7ff]"><span className="h-2 w-2 rounded-full bg-[#aeb7ff]"/> Duelio original · WikiRush</p>
          <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[.95] tracking-[-.06em] sm:text-7xl">One page.<br/><span className="text-[#aeb7ff]">A whole world away.</span></h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">Race between two random Wikipedia articles using only the links on the page. No search shortcuts. Read, connect the dots, and arrive before the timer ends.</p>
          <div className="mt-7 flex flex-wrap gap-3"><a href="#play" className="rounded-xl bg-[#6978f5] px-5 py-3 font-extrabold text-white hover:bg-[#5866df]">Enter the race ↓</a><Link href="/leaderboard" className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white/80">Global leaderboard ↗</Link></div>
        </div>
        <div className="grid grid-cols-3 gap-2">{[['01','Start'],['02','Navigate'],['03','Arrive']].map(([n,t])=><div key={n} className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><p className="text-xs font-black text-[#aeb7ff]">{n}</p><p className="mt-2 font-extrabold">{t}</p></div>)}</div>
      </div>
    </section>
    <div id="play" className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0 rounded-3xl border border-[#e1e4ef] bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#6978f5]">The main event</p><h2 className="mt-2 text-3xl font-black tracking-tight">The WikiRush trail</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">Read each controlled article view and follow one of its outgoing links. Your route is tracked as you move.</p></div><div className="rounded-2xl bg-[#101426] px-4 py-3 text-right text-white"><p className="text-[10px] font-black uppercase tracking-widest text-white/60">Time left</p><p className="text-3xl font-black tabular-nums">{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</p></div></div>
        <div className="mt-6 grid grid-cols-3 gap-2">{timers.map(t=><button key={t} disabled={status==='playing'} onClick={()=>{setDuration(t);setSeconds(t)}} className={`rounded-xl border px-3 py-3 text-sm font-extrabold transition ${duration===t?'border-[#6978f5] bg-[#eef0ff] text-[#4857d7]':'border-slate-200 hover:border-slate-400'}`}>{t} seconds</button>)}</div>
        {status==='idle' && <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef0ff] text-3xl">⌘</div><h3 className="mt-4 text-xl font-black">Ready to disappear down the rabbit hole?</h3><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">We pick two random Wikipedia pages. Navigate from the first to the hidden destination by following article links alone.</p><button disabled={busy} onClick={begin} className="mt-5 rounded-xl bg-[#6978f5] px-6 py-3 font-extrabold text-white hover:bg-[#5866df] disabled:opacity-50">{busy?'Finding your trail…':'Start a WikiRush →'}</button></div>}
        {start && target && status!=='idle' && <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-black uppercase tracking-widest text-slate-400">Start here</p><h3 className="mt-2 text-lg font-black">{start.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-500">{start.extract}</p></div><div className="rounded-2xl border border-[#6978f5]/30 bg-[#f4f5ff] p-4"><p className="text-xs font-black uppercase tracking-widest text-[#6978f5]">Your destination</p><h3 className="mt-2 text-lg font-black">{target.title}</h3><p className="mt-2 text-sm text-slate-500">The game checks your clicked page title against this destination. The target is revealed after the run.</p></div></div>}
        {status==='playing' && article && <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200"><div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><p className="text-xs font-black uppercase tracking-widest text-slate-400">Current page · {history.length + 1} page{history.length === 0 ? '' : 's'} visited</p><h3 className="mt-1 text-2xl font-black">{article.title}</h3></div><div className="p-5"><p className="max-w-3xl text-base leading-8 text-slate-700">{article.extract || 'Explore this page by following one of its links below.'}</p>{article.thumbnail?.source && <img src={article.thumbnail.source} alt="" className="mt-4 max-h-64 rounded-xl object-contain object-left"/>}<p className="mt-6 text-xs font-black uppercase tracking-widest text-slate-400">In this article · choose a link</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{links.map(x=><button key={x} disabled={busy} onClick={()=>openLinked(x)} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-semibold hover:border-[#6978f5] hover:bg-[#f4f5ff] disabled:opacity-50"><span>{x}</span><span className="shrink-0 text-[#6978f5]">↗</span></button>)}</div>{busy&&<p className="mt-4 text-sm text-slate-500">Opening article…</p>}</div></div>}
        {(status==='won'||status==='lost') && <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center"><p className="text-4xl">{status==='won'?'🏁':'⌛'}</p><h3 className="mt-2 text-2xl font-black">{status==='won'?'Trail conquered':'Time ran out'}</h3><p className="mt-2 text-sm text-slate-500">{notice}</p>{target&&<p className="mt-2 text-sm font-bold">Destination: {target.title}</p>}<button onClick={()=>{setStatus('idle');setStart(null);setTarget(null);setArticle(null);setSeconds(duration);setStartedAt(null);setNotice('');setHistory([])}} className="mt-5 rounded-xl bg-[#101426] px-5 py-3 font-extrabold text-white">Run it back ↻</button></div>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        {notice && status==='playing' && <p role="status" className="mt-4 rounded-xl bg-[#eef0ff] p-3 text-sm font-semibold text-[#4857d7]">{notice}</p>}
        {!session && <div className="mt-6 rounded-2xl border border-slate-200 p-5"><h3 className="text-lg font-black">Save your name to the leaderboard</h3><p className="mt-1 text-sm text-slate-500">Create a free account with a display name and password. No email confirmation is needed once Confirm email is disabled in Supabase.</p><form onSubmit={auth} className="mt-4 grid gap-3 sm:grid-cols-2">{signup&&<label className="text-sm font-bold sm:col-span-2">Display name<input required maxLength={24} value={displayName} onChange={e=>setDisplayName(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3" placeholder="Trailblazer"/></label>}<label className="text-sm font-bold sm:col-span-2">Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3" placeholder="you@example.com"/></label><label className="text-sm font-bold sm:col-span-2">Password<input required minLength={8} type="password" autoComplete={signup?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3" placeholder="At least 8 characters"/></label><label className="text-sm font-bold sm:col-span-2">Referral code <span className="font-normal text-slate-400">(optional)</span><input value={referralCode} onChange={e=>setReferralCode(e.target.value)} maxLength={40} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3" placeholder="Enter a friend's code"/></label><button className="min-h-11 rounded-xl bg-[#6978f5] px-4 font-extrabold text-white">{signup?'Create account':'Sign in'}</button><button type="button" onClick={()=>setSignup(v=>!v)} className="min-h-11 rounded-xl border border-slate-200 px-4 font-bold">{signup?'I already have an account':'New here? Sign up'}</button></form></div>}
        {session && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"><div><p className="font-extrabold">Playing as {session.user.user_metadata?.display_name || session.user.email}</p><p className="text-xs text-slate-500">Your profile and saved score sync to Duelio.</p><div className="mt-2 flex flex-wrap gap-3 text-sm font-bold"><Link href="/profile" className="underline">Profile</Link><Link href="/settings" className="underline">Settings</Link><Link href="/leaderboard" className="underline">Leaderboard</Link></div></div><button onClick={signOut} className="text-sm font-bold underline">Sign out</button></div>}
      </section>
      <aside className="space-y-4"><div className="rounded-3xl bg-[#101426] p-6 text-white"><p className="text-xs font-black uppercase tracking-widest text-[#aeb7ff]">Your expedition</p><p className="mt-4 text-4xl font-black">{points.toLocaleString()}</p><p className="text-sm text-white/60">total points</p><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-black">{streak}</p><p className="text-xs text-white/60">day streak</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-black">{runs}</p><p className="text-xs text-white/60">runs played</p></div></div><Link href="/profile" className="mt-4 inline-flex text-sm font-bold underline">Open profile →</Link></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5"><h3 className="font-black">Play fair. Play smart.</h3><ul className="mt-3 space-y-3 text-sm leading-relaxed text-slate-500"><li>↗ Navigate through article links; no search shortcuts.</li><li>◷ The clock runs continuously from trail generation.</li><li>✦ Faster finishes earn more points.</li><li>♧ Invite friends to earn a one-time referral bonus.</li></ul><Link href="/leaderboard" className="mt-4 inline-flex font-extrabold text-[#5968ec] underline">See all explorers →</Link></div>
      </aside>
    </div>
    {fullscreen && <div className="fixed inset-0 z-[100] flex flex-col bg-[#f7f7f4] text-[#202536]" role="dialog" aria-modal="true" aria-label="WikiRush full-screen game">
      <header className="flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 shadow-sm sm:px-8"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#6978f5]">DUELIO / WIKIRUSH</p><p className="truncate text-sm font-extrabold sm:text-base">{article?.title}</p></div><div className="flex shrink-0 items-center gap-3"><div className={`rounded-xl px-4 py-2 text-right ${seconds <= 10 ? 'bg-red-100 text-red-700' : 'bg-[#101426] text-white'}`}><p className="text-[9px] font-black uppercase tracking-widest opacity-70">Time left</p><p className="text-2xl font-black tabular-nums">{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</p></div><button onClick={()=>{setStatus('lost');setNotice('You ended this run early.');}} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">Exit</button></div></header>
      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px]"><article className="overflow-y-auto px-5 py-7 sm:px-10 lg:px-16"><div className="mx-auto max-w-4xl"><div className="mb-5 flex items-center gap-2 text-xs text-slate-500"><span>Wikipedia-inspired reading view</span><span>·</span><span>Page {history.length + 1}</span></div><h1 className="border-b border-slate-300 pb-4 text-4xl font-normal tracking-tight sm:text-6xl">{article?.title}</h1>{article?.thumbnail?.source&&<img src={article.thumbnail.source} alt="" className="float-right ml-5 mt-5 max-h-56 max-w-[45%] rounded-lg object-contain"/>}<p className="mt-6 whitespace-pre-line text-lg leading-9 text-slate-800">{article?.extract || 'This article has no summary. Continue by choosing one of the article links.'}</p><p className="mt-8 border-t border-slate-200 pt-5 text-sm text-slate-500">This controlled game view uses summaries and link metadata from Wikipedia’s public API. Links remain inside the timed challenge.</p><div className="clear-both h-8"/></div></article>
      <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-white lg:border-l lg:border-t-0"><div className="border-b border-slate-200 p-5"><p className="text-xs font-black uppercase tracking-widest text-[#6978f5]">Mission target</p><p className="mt-2 text-lg font-black">{target?.title}</p><p className="mt-1 text-xs text-slate-500">Reach this exact page title by clicking an article link.</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#6978f5] transition-all" style={{width:`${Math.min(100, (history.length / 12) * 100)}%`}}/></div><p className="mt-2 text-xs text-slate-500">{history.length} links followed</p></div><div className="min-h-0 flex-1 overflow-y-auto p-4"><p className="px-1 text-xs font-black uppercase tracking-widest text-slate-400">Article links</p><div className="mt-3 space-y-1">{links.map(x=><button key={x} disabled={busy} onClick={()=>openLinked(x)} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[#3153ad] hover:bg-[#eef0ff] disabled:opacity-50"><span>{x}</span><span>›</span></button>)}</div>{busy&&<p className="p-3 text-sm text-slate-500">Loading article…</p>}{error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}</div><div className="border-t border-slate-200 p-4"><p className="text-xs text-slate-500">Start: {start?.title}</p><p className="mt-1 text-xs text-slate-500">Follow connected knowledge. No search.</p></div></aside></div>
    </div>}
  </main>;
}
