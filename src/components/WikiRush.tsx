"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { ensureWikiProfile } from '@/lib/wikirush-client';
import Game from './wikirush/Game';
import Lobby, { type BoardRow } from './wikirush/Lobby';
import AuthPanel from './wikirush/AuthPanel';
import { DAILY_SETTINGS, type ChallengeParams, type GameMode, type GameSettings, type GameSummary } from '@/lib/wikirush/types';
import { dailySeed, utcDateKey } from '@/lib/wikirush/rounds';
import { randomSeed } from '@/lib/wikirush/rng';
import { parseChallengeParams } from '@/lib/wikirush/share';
import { DEFAULT_PREFS, EMPTY_STATS, applyGame, loadPrefs, loadStats, savePrefs, saveStats, type WikiPrefs, type WikiStats } from '@/lib/wikirush/stats';
import { RunRecorder, canReel, canScreen } from '@/lib/wikirush/recorder';
import type { OverlayState } from '@/lib/wikirush/overlay';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const IDLE_OVERLAY: OverlayState = {
  phase: 'idle', modeLabel: '', roundIdx: 0, rounds: 1, startTitle: '', targetTitle: '', currentTitle: '',
  msLeft: 0, limitMs: 1, clicks: 0, path: [], totalScore: 0,
};

type Active = { id: number; settings: GameSettings; recorder: RunRecorder | null };

export default function WikiRush() {
  const supabase = useMemo<SupabaseClient | null>(() => SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null, []);
  const [session, setSession] = useState<Session | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [startInSignup, setStartInSignup] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [points, setPoints] = useState(0);
  const [loginStreak, setLoginStreak] = useState(0);
  const [runs, setRuns] = useState(0);
  const [prefs, setPrefsState] = useState<WikiPrefs>(DEFAULT_PREFS);
  const [stats, setStats] = useState<WikiStats>(EMPTY_STATS);
  const [challenge, setChallenge] = useState<ChallengeParams | null>(null);
  const [caps, setCaps] = useState({ screen: false, reel: false });
  const [dailyKey, setDailyKey] = useState(() => utcDateKey());
  const [board, setBoard] = useState<BoardRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<Active | null>(null);
  const overlayRef = useRef<OverlayState>(IDLE_OVERLAY);
  const gameId = useRef(0);

  // Browser-only state (storage, capabilities, URL) is read after mount to keep SSR markup stable.
  useEffect(() => {
    const loaded = loadPrefs();
    const screen = canScreen(); const reel = canReel();
    setCaps({ screen, reel });
    setPrefsState({ ...loaded, recordMethod: loaded.recordMethod === 'screen' && !screen ? 'reel' : loaded.recordMethod });
    setStats(loadStats());
    setDailyKey(utcDateKey());
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) { setReferralCode(ref.slice(0, 40)); setStartInSignup(true); }
    setChallenge(parseChallengeParams(window.location.search));
  }, []);

  const setPrefs = useCallback((p: WikiPrefs) => { setPrefsState(p); savePrefs(p); }, []);

  // ---------- account ----------
  const refreshProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('wiki_profiles').select('points, login_streak, runs_played').eq('user_id', userId).maybeSingle();
    if (data) { setPoints(Number(data.points || 0)); setLoginStreak(data.login_streak || 0); setRuns(data.runs_played || 0); }
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!session?.user || !supabase) return;
    let alive = true;
    (async () => {
      await ensureWikiProfile(supabase, session.user);
      if (alive) await refreshProfile(session.user.id);
      const code = referralCode || String(session.user.user_metadata?.referral_code || '');
      if (code) {
        const { data: claimed, error: refErr } = await supabase.rpc('claim_wikirush_referral', { p_referral_code: code });
        if (alive && claimed) { setNotice('Referral bonus claimed! You and your friend earned 100 points each.'); await refreshProfile(session.user.id); }
        else if (alive && refErr) setNotice('Account ready. The referral bonus could not be applied; check the database setup.');
        setReferralCode('');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, supabase]);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('wikirush_daily_board').select('display_name, total').eq('seed', dailySeed(dailyKey)).order('total', { ascending: false }).limit(10)
      .then(({ data, error: err }) => { if (!err && data) setBoard(data as BoardRow[]); });
  }, [supabase, dailyKey, active]);

  const playerName = String(session?.user.user_metadata?.display_name || prefs.name || '').slice(0, 24) || undefined;

  // ---------- starting a game ----------
  async function start(mode: GameMode) {
    setError(''); setNotice('');
    if (!session?.user) {
      const freeRuns = Number(window.localStorage.getItem('wikirush_free_runs') || '0');
      if (freeRuns >= 1) {
        setStartInSignup(true);
        setError('Your free WikiRush run has been used. Create a free account to keep playing — your local stats stay on this device.');
        document.getElementById('wikirush-auth')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    setBusy(true);
    try {
      let settings: GameSettings;
      if (mode === 'daily') settings = { mode, ...DAILY_SETTINGS, seed: dailySeed(utcDateKey()) };
      else if (mode === 'challenge' && challenge) settings = { mode, rounds: challenge.rounds, seconds: challenge.seconds, seed: challenge.seed };
      else if (mode === 'wild') settings = { mode, rounds: prefs.rounds, seconds: prefs.seconds };
      else {
        let seed = randomSeed();
        if (!session?.user) {
          const freeRuns = Number(window.localStorage.getItem('wikirush_free_runs') || '0');
          seed = `onboarding-${freeRuns}`;
        }
        settings = { mode: 'classic', rounds: prefs.rounds, seconds: prefs.seconds, seed };
      }
      await launch(settings);
    } finally { setBusy(false); }
  }

  async function launch(settings: GameSettings) {
    let recorder: RunRecorder | null = null;
    if (prefs.record && (caps.screen || caps.reel)) {
      const method = prefs.recordMethod === 'screen' && caps.screen ? 'screen' : caps.reel ? 'reel' : null;
      if (method) {
        try {
          recorder = new RunRecorder(method, () => overlayRef.current);
          overlayRef.current = { ...IDLE_OVERLAY };
          await recorder.start(); // must run inside the click that started the game (screen-capture permission)
        } catch (e) {
          recorder = null;
          const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError');
          setNotice(denied ? 'Screen sharing was cancelled, so this run will not be recorded. Starting the game anyway.' : `Recording is unavailable (${e instanceof Error ? e.message : 'unknown error'}). Starting without it.`);
        }
      }
    }
    gameId.current += 1;
    setActive({ id: gameId.current, settings, recorder });
  }

  const onFinish = useCallback(async (summary: GameSummary): Promise<string> => {
    setStats(prev => { const next = applyGame(prev, summary); saveStats(next); return next; });
    if (!session?.user) {
      const used = Number(window.localStorage.getItem('wikirush_free_runs') || '0');
      window.localStorage.setItem('wikirush_free_runs', String(Math.max(used, 1)));
    }
    if (!supabase || !session?.user) return 'Create a free account to put your score on the leaderboard.';
    const { data, error: err } = await supabase.rpc('submit_wikirush_game', {
      p_mode: summary.settings.mode, p_seed: summary.settings.seed ?? null, p_rounds: summary.settings.rounds, p_seconds: summary.settings.seconds,
      p_results: summary.results.map(r => ({ won: r.won, elapsed_ms: Math.round(r.elapsedMs), clicks: r.clicks, radar: r.radar, near: r.near })),
    });
    if (err) return 'Saved on this device. The online leaderboard needs the WikiRush v2 database migration.';
    await refreshProfile(session.user.id);
    const res = (data || {}) as { points?: number; ranked?: boolean };
    if (summary.settings.mode === 'daily' && res.ranked === false) return 'Already ranked today. This replay is practice only.';
    return res.points ? `+${res.points.toLocaleString()} leaderboard points saved.` : 'Saved to your profile.';
  }, [refreshProfile, session, supabase]);

  const exit = useCallback(() => { setActive(null); overlayRef.current = IDLE_OVERLAY; if (typeof window !== 'undefined' && window.location.search) window.history.replaceState(null, '', '/wikirush'); setChallenge(null); }, []);

  const again = useCallback((settings: GameSettings) => {
    setActive(null);
    // Let the old game unmount (and release its recorder) before the next one mounts.
    window.setTimeout(() => { void (async () => { setBusy(true); try { await launch(settings); } finally { setBusy(false); } })(); }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs, caps]);

  const dailyScore = stats.daily[dailyKey];

  return <main className="min-h-[80vh] bg-[#f6f7fb] pb-16">
    <section className="relative overflow-hidden bg-[#101426] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" style={{ background: 'radial-gradient(60% 80% at 90% 0%, rgba(105,120,245,.45), transparent 60%), radial-gradient(40% 60% at 0% 100%, rgba(231,93,135,.28), transparent 60%)' }} />
      <div className="relative mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:py-16 lg:grid-cols-[1fr_340px] lg:items-end">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[.18em] text-[#aeb7ff]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#aeb7ff]" /> Duelio original · WikiRush</p>
          <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[.95] tracking-[-.06em] sm:text-7xl">GeoGuessr,<br /><span className="text-[#aeb7ff]">but for Wikipedia.</span></h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">You’re dropped on a random page and shown a destination. Click only the links inside the article to get there before the clock runs out. Five rounds. One score. Your friends will want a rematch.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#play" className="rounded-xl bg-[#6978f5] px-5 py-3 font-extrabold text-white hover:bg-[#5866df]">Play now ↓</a>
            <Link href="/leaderboard" className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white/80 hover:bg-white/5">Global leaderboard ↗</Link>
          </div>
        </div>
        <ol className="grid gap-2 text-sm">
          {[['1', 'See your start and destination', 'Two real pages, shown before the clock starts.'], ['2', 'Hop through links', 'No search. Use Radar if you’re stuck (−600).'], ['3', 'Arrive, score, share', 'Speed and fewer clicks earn more. Post your emoji row.']].map(([n, t, d]) =>
            <li key={n} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.05] p-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#6978f5] text-xs font-black">{n}</span><span><span className="block font-extrabold">{t}</span><span className="text-white/60">{d}</span></span></li>)}
        </ol>
      </div>
    </section>

    <div id="play" className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0 space-y-6">
        <Lobby prefs={prefs} setPrefs={setPrefs} stats={stats} dailyKey={dailyKey} dailyScore={dailyScore} challenge={challenge}
          canScreen={caps.screen} canReel={caps.reel} busy={busy} error={error} notice={notice} board={board} onStart={m => void start(m)} />
        <div id="wikirush-auth"><AuthPanel supabase={supabase} session={session} referralCode={referralCode} setReferralCode={setReferralCode} startInSignup={startInSignup}
          onSession={(s, n) => { setSession(s); if (n) setNotice(n); }} /></div>
      </section>
      <aside className="space-y-4">
        <div className="rounded-3xl bg-[#101426] p-6 text-white">
          <p className="text-xs font-black uppercase tracking-widest text-[#aeb7ff]">Your expedition</p>
          <p className="mt-4 text-4xl font-black tabular-nums">{points.toLocaleString()}</p>
          <p className="text-sm text-white/60">leaderboard points</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-black">{loginStreak}</p><p className="text-xs text-white/60">login streak</p></div>
            <div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-black">{runs}</p><p className="text-xs text-white/60">rounds played</p></div>
          </div>
          <Link href="/profile" className="mt-4 inline-flex text-sm font-bold underline">Open profile →</Link>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h3 className="font-black">Pro tips</h3>
          <ul className="mt-3 space-y-3 text-sm leading-relaxed text-slate-500">
            <li>🌍 Climb to a hub first: countries, cities and years link to everything.</li>
            <li>🎯 Think about what the destination’s page links <em>from</em>: who, where, when.</li>
            <li>⏸️ The clock pauses while a page loads, so slow Wi-Fi isn’t punished.</li>
            <li>🎥 Turn on recording before you start to get a post-ready clip.</li>
          </ul>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          <p>Invite friends with your referral link in your <Link href="/profile" className="font-bold text-[#5968ec] underline">profile</Link> for a one-time bonus.</p>
        </div>
      </aside>
    </div>

    {active && <Game key={active.id} settings={active.settings} recorder={active.recorder} overlayRef={overlayRef} sound={prefs.sound}
      playerName={playerName} challenge={active.settings.mode === 'challenge' ? challenge : null} onFinish={onFinish} onExit={exit} onPlayAgain={again} />}
  </main>;
}
