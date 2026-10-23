"use client";

import { useEffect, useMemo, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Article = { title: string; extract?: string; pageid?: number; thumbnail?: { source: string } };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const timers = [30, 60, 120];

export default function WikiRush() {
  const supabase = useMemo<SupabaseClient | null>(() => SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null, []);
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [signup, setSignup] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [duration, setDuration] = useState(60);
  const [seconds, setSeconds] = useState(60);
  const [start, setStart] = useState<Article | null>(null);
  const [target, setTarget] = useState<Article | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle'|'playing'|'won'|'lost'>('idle');
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [runs, setRuns] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!session?.user || !supabase) return;
    supabase.from('wiki_profiles').select('points, login_streak, best_streak, runs_played').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => { if (data) { setPoints(data.points || 0); setStreak(data.login_streak || 0); setRuns(data.runs_played || 0); } });
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

  async function auth(e: React.FormEvent) {
    e.preventDefault(); setError(''); setNotice('');
    if (!supabase) { setError('Account service is not configured yet. Add the public Supabase URL and anon key to the deployment environment.'); return; }
    if (signup) {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName.trim() } } });
      if (error) setError(error.message);
      else { setSession(data.session); setNotice(data.session ? 'Account ready. Your first run awaits.' : 'Check your email to confirm your account, then sign in.'); setSignup(false); }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message); else { setSession(data.session); setNotice('Welcome back. Ready to chase a page?'); }
    }
  }

  async function randomArticle(): Promise<Article> {
    const res = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary');
    if (!res.ok) throw new Error('Wikipedia is having trouble. Try again in a moment.');
    const data = await res.json();
    return { title: data.title, extract: data.extract, pageid: data.pageid, thumbnail: data.thumbnail };
  }

  async function begin() {
    setBusy(true); setError(''); setNotice('');
    try {
      const a = await randomArticle();
      let b: Article | null = null;
      for (let i = 0; i < 5; i++) {
        const candidate = await randomArticle();
        if (candidate.title !== a.title) { b = candidate; break; }
      }
      if (!b) throw new Error('Could not build a trail. Try again.');
      setStart(a); setTarget(b); setArticle(a); setDuration(duration); setSeconds(duration);
      setStartedAt(Date.now()); setStatus('playing'); setRuns(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start a run.'); }
    finally { setBusy(false); }
  }

  async function openLinked(title: string) {
    if (status !== 'playing' || !target) return;
    if (title.replaceAll('_',' ').toLocaleLowerCase() === target.title.toLocaleLowerCase()) {
      const elapsed = startedAt ? Math.max(0, (Date.now() - startedAt) / 1000) : duration;
      if (elapsed > duration) { setStatus('lost'); return; }
      const earned = Math.max(25, Math.round(100 + (duration - elapsed) * 3));
      setStatus('won'); setSeconds(Math.max(0, Math.ceil(duration - elapsed)));
      setPoints(v => v + earned); setNotice(`Trail complete! +${earned} points. You found ${target.title} in ${elapsed.toFixed(1)} seconds.`);
      if (supabase && session?.user) {
        const { error: saveError } = await supabase.rpc('finish_wikirush_run', { p_points: earned, p_elapsed_ms: Math.round(elapsed * 1000), p_duration_seconds: duration, p_start_title: start?.title, p_target_title: target.title });
        if (saveError) setNotice(`Trail complete! +${earned} points locally. Score sync unavailable: ${saveError.message}`);
        else { const { data } = await supabase.from('wiki_profiles').select('points, login_streak, runs_played').eq('user_id', session.user.id).maybeSingle(); if (data) { setPoints(data.points || 0); setStreak(data.login_streak || 0); setRuns(data.runs_played || 0); } }
      }
      return;
    }
    try { setBusy(true); const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ','_'))}`); if (res.ok) { const d = await res.json(); setArticle({ title: d.title || title, extract: d.extract, pageid: d.pageid, thumbnail: d.thumbnail }); } }
    finally { setBusy(false); }
  }

  async function signOut() { await supabase?.auth.signOut(); setSession(null); setStatus('idle'); }

  return <main className="min-h-[80vh] bg-[#f6f7fb] pb-16">
    <section className="overflow-hidden bg-[#101426] text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:py-16 lg:grid-cols-[1fr_330px] lg:items-end">
        <div><p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[.18em] text-[#aeb7ff]"><span className="h-2 w-2 rounded-full bg-[#aeb7ff]"/> Duelio original · WikiRush</p>
          <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[.95] tracking-[-.06em] sm:text-7xl">One page.<br/><span className="text-[#aeb7ff]">A whole world away.</span></h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">Start anywhere on Wikipedia. Find your target by following the links before the clock runs out. No search bar. Just curiosity, strategy, and speed.</p>
          <div className="mt-7 flex flex-wrap gap-3"><a href="#play" className="rounded-xl bg-[#6978f5] px-5 py-3 font-extrabold text-white hover:bg-[#5866df]">Enter the race ↓</a><span className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white/70">Explore. Connect. Conquer.</span></div>
        </div>
        <div className="grid grid-cols-3 gap-2">{[['01','Start'],['02','Navigate'],['03','Arrive']].map(([n,t])=><div key={n} className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><p className="text-xs font-black text-[#aeb7ff]">{n}</p><p className="mt-2 font-extrabold">{t}</p></div>)}</div>
      </div>
    </section>
    <div id="play" className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0 rounded-3xl border border-[#e1e4ef] bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#6978f5]">The main event</p><h2 className="mt-2 text-3xl font-black tracking-tight">The WikiRush trail</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">Reach the destination using links in each article. Every click is a new fork in the road.</p></div><div className="rounded-2xl bg-[#101426] px-4 py-3 text-right text-white"><p className="text-[10px] font-black uppercase tracking-widest text-white/60">Time left</p><p className="text-3xl font-black tabular-nums">{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</p></div></div>
        <div className="mt-6 grid grid-cols-3 gap-2">{timers.map(t=><button key={t} disabled={status==='playing'} onClick={()=>{setDuration(t);setSeconds(t)}} className={`rounded-xl border px-3 py-3 text-sm font-extrabold transition ${duration===t?'border-[#6978f5] bg-[#eef0ff] text-[#4857d7]':'border-slate-200 hover:border-slate-400'}`}>{t} seconds</button>)}</div>
        {status==='idle' && <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef0ff] text-3xl">⌘</div><h3 className="mt-4 text-xl font-black">Ready to disappear down the rabbit hole?</h3><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">We pick two random Wikipedia pages. Your job is to navigate from the first to the second using article links alone.</p><button disabled={busy} onClick={begin} className="mt-5 rounded-xl bg-[#6978f5] px-6 py-3 font-extrabold text-white hover:bg-[#5866df] disabled:opacity-50">{busy?'Finding your trail…':'Start a WikiRush →'}</button></div>}
        {start && target && status!=='idle' && <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-black uppercase tracking-widest text-slate-400">Start here</p><h3 className="mt-2 text-lg font-black">{start.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-500">{start.extract}</p></div><div className="rounded-2xl border border-[#6978f5]/30 bg-[#f4f5ff] p-4"><p className="text-xs font-black uppercase tracking-widest text-[#6978f5]">Your destination</p><h3 className="mt-2 text-lg font-black">{target.title}</h3><p className="mt-2 text-sm text-slate-500">Find a path to this page before time runs out.</p></div></div>}
        {status==='playing' && article && <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200"><div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><p className="text-xs font-black uppercase tracking-widest text-slate-400">Current page</p><h3 className="mt-1 text-2xl font-black">{article.title}</h3></div><div className="p-5"><p className="leading-relaxed text-slate-600">{article.extract || 'Explore this page by following one of its links below.'}</p><p className="mt-5 text-xs font-black uppercase tracking-widest text-slate-400">Choose your next link</p><div className="mt-3 flex flex-wrap gap-2">{(article.title===start?.title ? [article.title, 'History', 'Science', 'Culture', 'Geography', 'Technology', 'Philosophy', 'Art'] : ['History','Science','Culture','Geography','Technology','Philosophy','Art','Society']).filter((x,i,a)=>a.indexOf(x)===i).map(x=><button key={x} disabled={busy} onClick={()=>openLinked(x)} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-bold hover:border-[#6978f5] hover:bg-[#f4f5ff]">{x} ↗</button>)}</div><p className="mt-3 text-xs text-slate-400">Choose links to explore articles. Target arrival is validated against the active run timer.</p></div></div>}
        {(status==='won'||status==='lost') && <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center"><p className="text-4xl">{status==='won'?'🏁':'⌛'}</p><h3 className="mt-2 text-2xl font-black">{status==='won'?'Trail conquered':'Time ran out'}</h3><p className="mt-2 text-sm text-slate-500">{notice}</p><button onClick={()=>{setStatus('idle');setStart(null);setTarget(null);setArticle(null);setSeconds(duration);setStartedAt(null);setNotice('')}} className="mt-5 rounded-xl bg-[#101426] px-5 py-3 font-extrabold text-white">Run it back ↻</button></div>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        {notice && status==='playing' && <p role="status" className="mt-4 rounded-xl bg-[#eef0ff] p-3 text-sm font-semibold text-[#4857d7]">{notice}</p>}
        {!session && <div className="mt-6 rounded-2xl border border-slate-200 p-5"><h3 className="text-lg font-black">Save your name to the leaderboard</h3><p className="mt-1 text-sm text-slate-500">Create a free account to keep points, daily streaks, and your record.</p><form onSubmit={auth} className="mt-4 grid gap-3 sm:grid-cols-2">{signup&&<label className="text-sm font-bold sm:col-span-2">Display name<input required maxLength={24} value={displayName} onChange={e=>setDisplayName(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3" placeholder="Trailblazer"/></label>}<label className="text-sm font-bold sm:col-span-2">Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3" placeholder="you@example.com"/></label><label className="text-sm font-bold sm:col-span-2">Password<input required minLength={8} type="password" autoComplete={signup?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3" placeholder="At least 8 characters"/></label><button className="min-h-11 rounded-xl bg-[#6978f5] px-4 font-extrabold text-white">{signup?'Create account':'Sign in'}</button><button type="button" onClick={()=>setSignup(v=>!v)} className="min-h-11 rounded-xl border border-slate-200 px-4 font-bold">{signup?'I already have an account':'New here? Sign up'}</button></form></div>}
        {session && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"><div><p className="font-extrabold">Playing as {session.user.user_metadata?.display_name || session.user.email}</p><p className="text-xs text-slate-500">Your profile and saved score sync to Duelio.</p></div><button onClick={signOut} className="text-sm font-bold underline">Sign out</button></div>}
      </section>
      <aside className="space-y-4"><div className="rounded-3xl bg-[#101426] p-6 text-white"><p className="text-xs font-black uppercase tracking-widest text-[#aeb7ff]">Your expedition</p><p className="mt-4 text-4xl font-black">{points.toLocaleString()}</p><p className="text-sm text-white/60">total points</p><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-black">{streak}</p><p className="text-xs text-white/60">day streak</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-black">{runs}</p><p className="text-xs text-white/60">runs played</p></div></div></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5"><h3 className="font-black">Play fair. Play smart.</h3><ul className="mt-3 space-y-3 text-sm leading-relaxed text-slate-500"><li>↗ Navigate through article links; don’t use search to jump ahead.</li><li>◷ The clock starts when the trail is generated.</li><li>✦ Faster finishes earn more points.</li><li>♧ Share your run and challenge a friend to beat your time.</li></ul></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-xs font-black uppercase tracking-widest text-[#6978f5]">Coming up next</p><h3 className="mt-2 font-black">Daily trails · Friends · Leagues</h3><p className="mt-2 text-sm leading-relaxed text-slate-500">A daily challenge, head-to-head races, achievements, referral bonuses, and global rankings are natural next layers for WikiRush.</p></div>
      </aside>
    </div>
  </main>;
}
