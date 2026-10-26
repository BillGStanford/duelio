"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { ensureWikiProfile } from '@/lib/wikirush-client';
import Game from './wikirush/Game';
import Lobby, { type BoardRow } from './wikirush/Lobby';
import { createPortal } from 'react-dom';
import PlayerCard from '@/components/game/PlayerCard';
import TopPlayers from '@/components/game/TopPlayers';
import AuthPanel from './wikirush/AuthPanel';
import { levelFor, pointsForGame } from '@/lib/wikirush/levels';
import { featuredSeed, type Featured } from '@/lib/wikirush/featured';
import { DAILY_SETTINGS, type ChallengeParams, type GameMode, type GameSettings, type GameSummary } from '@/lib/wikirush/types';
import { dailyNumber, dailySeed, freshSeed, HARD_PREFIX, planRounds, utcDateKey } from '@/lib/wikirush/rounds';
import { warmRound } from '@/lib/wikirush/wiki';
import { randomSeed } from '@/lib/wikirush/rng';
import { addPending, clearPending, guestUsedCookie, guestUsedLocally, loadPending, markGuestUsed, mustSignUp } from '@/lib/wikirush/guest';
import { guestIds } from '@/lib/wikirush/fingerprint';
import { parseChallengeParams } from '@/lib/wikirush/share';
import { DEFAULT_PREFS, EMPTY_STATS, applyGame, loadPrefs, loadStats, savePrefs, saveStats, type WikiPrefs, type WikiStats } from '@/lib/wikirush/stats';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

type Active = { id: number; settings: GameSettings };

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
  const [dailyKey, setDailyKey] = useState(() => utcDateKey());
  const [board, setBoard] = useState<BoardRow[] | null>(null);
  const [top, setTop] = useState<Array<{ display_name: string; points: number }> | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [stream, setStream] = useState(false);
  const [featured, setFeatured] = useState<Featured[]>([]);
  const [featuredId, setFeaturedId] = useState('');
  const [authReady, setAuthReady] = useState(!SUPABASE_URL || !SUPABASE_KEY);
  const [auto, setAuto] = useState<'play' | 'daily' | 'hard' | 'wild' | null>(null);
  const autoDone = useRef(false);
  const [active, setActive] = useState<Active | null>(null);
  const gameId = useRef(0);

  // Browser-only state (storage, capabilities, URL) is read after mount to keep SSR markup stable.
  useEffect(() => {
    const loaded = loadPrefs();
    setPrefsState(loaded);
    setStats(loadStats());
    setDailyKey(utcDateKey());
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) { setReferralCode(ref.slice(0, 40)); setStartInSignup(true); }
    setChallenge(parseChallengeParams(window.location.search));
    try { if (params.get('stream') === '1') localStorage.setItem('wikirush:v2:stream', '1'); setStream(localStorage.getItem('wikirush:v2:stream') === '1'); } catch { setStream(params.get('stream') === '1'); }
    setFeaturedId((params.get('f') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40));
    if (params.get('play') === '1') setAuto('play'); else if (params.get('daily') === '1') setAuto('daily'); else if (params.get('mode') === 'hard') setAuto('hard'); else if (params.get('mode') === 'wild') setAuto('wild');
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
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); }, () => setAuthReady(true));
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

  /** Saves one game: the SQL function first, then the server route, which needs no migration. */
  const saveGame = useCallback(async (game: GameSummary): Promise<{ ok: true; points: number; ranked: boolean } | { ok: false; error: string }> => {
    if (!supabase || !session) return { ok: false, error: 'Not signed in' };
    const results = game.results.map(r => ({ won: r.won, elapsed_ms: Math.round(r.elapsedMs), clicks: r.clicks, radar: r.radar, near: r.near }));
    const { data, error: err } = await supabase.rpc('submit_wikirush_game', { p_mode: game.settings.mode, p_seed: game.settings.seed ?? null, p_rounds: game.settings.rounds, p_seconds: game.settings.seconds, p_results: results });
    if (!err) { const res = (data || {}) as { points?: number; ranked?: boolean }; return { ok: true, points: Number(res.points || 0), ranked: res.ranked !== false }; }
    try {
      const res = await fetch('/api/wikirush/points', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ mode: game.settings.mode, seed: game.settings.seed ?? null, rounds: game.settings.rounds, seconds: game.settings.seconds, results }) });
      const body = (await res.json()) as { points?: number; ranked?: boolean; error?: string };
      if (res.ok) return { ok: true, points: Number(body.points || 0), ranked: body.ranked !== false };
      return { ok: false, error: body.error || err.message };
    } catch { return { ok: false, error: err.message }; }
  }, [session, supabase]);

  // Points a previous build only kept on this device are recovered once per account.
  useEffect(() => {
    if (!session?.user || !supabase) return;
    const flag = `wikirush:v2:backfilled:${session.user.id}`;
    let device = 0;
    try { if (localStorage.getItem(flag)) return; device = pointsForGame(loadStats().totalScore) - loadPending().reduce((n, g) => n + pointsForGame(g.total), 0); } catch { return; }
    if (device <= 0) return;
    (async () => {
      try {
        const res = await fetch('/api/wikirush/points', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ backfill: device }) });
        if (res.ok) { try { localStorage.setItem(flag, '1'); } catch { /* ignore */ } await refreshProfile(session.user.id); }
      } catch { /* try again next visit */ }
    })();
  }, [session, supabase, refreshProfile]);

  // Everything played before the account existed is saved the moment the player signs in.
  useEffect(() => {
    if (!session?.user || !supabase) return;
    const queued = loadPending();
    if (!queued.length) return;
    let alive = true;
    (async () => {
      let saved = 0;
      for (const game of queued) {
        if (!alive) return;
        const r = await saveGame(game);
        if (!r.ok) break;
        saved += 1;
        if (saved < queued.length) await new Promise(res => setTimeout(res, 8500)); // the database rate-limits submissions
      }
      if (!alive) return;
      clearPending();
      queued.slice(saved).forEach(g => addPending(g)); // keep only what is still unsaved
      if (saved) { setNotice(`Welcome aboard! Your ${saved === 1 ? 'first game was' : `${saved} games were`} saved to your profile.`); void refreshProfile(session.user.id); }
      setGate(false);
    })();
    return () => { alive = false; };
  }, [session, supabase, refreshProfile, saveGame]);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('wikirush_daily_board').select('display_name, total').eq('seed', dailySeed(dailyKey)).order('total', { ascending: false }).limit(10)
      .then(({ data, error: err }) => { if (!err && data) setBoard(data as BoardRow[]); });
  }, [supabase, dailyKey, active]);

  // All-time standings, shown beside the lobby so the competition is always in view.
  useEffect(() => {
    if (!supabase) return;
    supabase.from('wiki_profiles').select('display_name, points').order('points', { ascending: false }).limit(8)
      .then(({ data, error: err }) => { if (!err && data) setTop(data as Array<{ display_name: string; points: number }>); });
    const mine = session?.user ? points : pointsForGame(stats.totalScore);
    if (mine > 0) {
      supabase.from('wiki_profiles').select('user_id', { count: 'exact', head: true }).gt('points', mine)
        .then(({ count, error: err }) => { if (!err && count !== null) setMyRank(count + 1); });
    } else setMyRank(null);
  }, [supabase, session, points, active, stats.totalScore]);

  const playerName = String(session?.user.user_metadata?.display_name || prefs.name || '').slice(0, 24) || undefined;

  // While the player reads the lobby, quietly load the first Daily round (and its links) so it opens instantly.
  useEffect(() => {
    const first = planRounds(dailySeed(utcDateKey()), DAILY_SETTINGS.rounds)[0];
    if (first) warmRound(first);
  }, []);

  // Landing-page PLAY / Daily buttons arrive here with ?play=1 or ?daily=1 and drop straight into a round.
  useEffect(() => {
    if (!auto || !authReady || autoDone.current) return;
    autoDone.current = true;
    window.history.replaceState(null, '', '/wikirush');
    void start(auto === 'daily' ? 'daily' : auto === 'wild' ? 'wild' : auto === 'hard' ? 'hard' : 'classic');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, authReady, prefs]);

  // Admin-built detail challenges, shown as featured cards in the lobby.
  useEffect(() => {
    fetch('/api/wikirush/featured').then(r => r.json()).then((d: { featured?: Featured[] }) => {
      if (Array.isArray(d.featured)) setFeatured(d.featured);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!featuredId || !featured.some(f => f.id === featuredId)) return;
    window.setTimeout(() => document.getElementById(`feat-${featuredId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
  }, [featuredId, featured]);

  async function startFeatured(f: Featured) {
    setError(''); setNotice(''); setBusy(true);
    try {
      if (await guestBlocked()) { openGate(); return; }
      await launch({ mode: 'challenge', rounds: f.pairs.length, seconds: f.seconds, seed: featuredSeed(f.id), custom: f.pairs, featuredId: f.id, featuredDay: f.day || undefined });
    } finally { setBusy(false); }
  }

  // ---------- starting a game ----------
  const configured = !!supabase;

  /** True when this visitor already used their free game (this browser, or this device on the server). */
  async function guestBlocked(): Promise<boolean> {
    if (!configured || session?.user) return false;
    const local = guestUsedLocally() || guestUsedCookie();
    if (local) return mustSignUp({ configured, signedIn: false, usedLocally: true, usedOnServer: false });
    try {
      const ids = await guestIds();
      if (!ids) return false;
      const res = await fetch('/api/wikirush/guest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'check', ...ids }) });
      const data = (await res.json()) as { gate?: boolean; used?: boolean };
      return mustSignUp({ configured: configured && data.gate !== false, signedIn: false, usedLocally: false, usedOnServer: !!data.used });
    } catch { return false; } // fail open: never lock someone out because a check failed
  }

  /** Burn the free game when it STARTS, so quitting and reloading mid-game is not a free retry. */
  async function claimFreeGame() {
    if (!configured || session?.user) return;
    markGuestUsed();
    try {
      const ids = await guestIds();
      if (ids) void fetch('/api/wikirush/guest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'claim', ...ids }) }).catch(() => {});
    } catch { /* ignore */ }
  }

  function openGate() {
    setGate(true);
    window.setTimeout(() => document.getElementById('account')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  }

  async function start(mode: GameMode | 'hard') {
    setError(''); setNotice(''); setBusy(true);
    try {
      if (await guestBlocked()) { openGate(); return; }
      let settings: GameSettings;
      if (mode === 'daily') settings = { mode, ...DAILY_SETTINGS, seed: dailySeed(utcDateKey()) };
      else if (mode === 'challenge' && challenge) settings = { mode, rounds: challenge.rounds, seconds: challenge.seconds, seed: challenge.seed };
      else if (mode === 'hard') settings = { mode: 'classic', rounds: prefs.rounds, seconds: prefs.seconds, seed: `${HARD_PREFIX}${randomSeed()}` };
      else if (mode === 'wild') settings = { mode, rounds: prefs.rounds, seconds: prefs.seconds };
      else settings = { mode: 'classic', rounds: prefs.rounds, seconds: prefs.seconds, seed: freshSeed(stats.games) };
      await launch(settings);
    } finally { setBusy(false); }
  }

  async function launch(settings: GameSettings) {
    gameId.current += 1;
    setActive({ id: gameId.current, settings });
  }

  const onFinish = useCallback(async (summary: GameSummary): Promise<string> => {
    setStats(prev => { const next = applyGame(prev, summary); saveStats(next); return next; });
    if (!supabase || !session?.user) {
      if (supabase) { addPending(summary); return 'Create a free account and this score is saved to your profile and the leaderboard.'; }
      return 'Accounts are not enabled here yet, so this score stays on this device.';
    }
    const r = await saveGame(summary);
    if (!r.ok) {
      // Never lose points: keep the game and retry automatically next time the page opens.
      addPending(summary);
      return `Could not save to the leaderboard yet (${r.error}). Your points are kept and will sync automatically.`;
    }
    await refreshProfile(session.user.id);
    if (summary.settings.mode === 'daily' && !r.ranked) return 'Already ranked today. This replay is practice only.';
    return r.points ? `+${r.points.toLocaleString()} leaderboard points saved to your account.` : 'Saved to your profile.';
  }, [refreshProfile, saveGame, session]);

  const exit = useCallback(() => { setActive(null); if (typeof window !== 'undefined' && window.location.search) window.history.replaceState(null, '', '/wikirush'); setChallenge(null); if (configured && !session?.user && (guestUsedLocally() || guestUsedCookie())) { setGate(true); window.setTimeout(() => document.getElementById('account')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80); } }, [configured, session]);

  const again = useCallback((incoming: GameSettings) => {
    // 'new' means: fresh pages, picked for this player's level.
    const settings = incoming.seed === 'new' ? { ...incoming, seed: freshSeed(stats.games) } : incoming;
    if (configured && !session?.user && (guestUsedLocally() || guestUsedCookie())) { exit(); return; } // free game is spent
    setActive(null);
    // Let the old game unmount before the next one mounts.
    window.setTimeout(() => { void (async () => { setBusy(true); try { await launch(settings); } finally { setBusy(false); } })(); }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs, configured, session, exit, stats.games]);

  const dailyScore = stats.daily[dailyKey];

  return <main className="gx-screen min-h-[80vh] pb-20">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/game/auth.jpg" alt="" className="gx-stars h-full w-full object-cover opacity-50" />
    <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-[#0b0f1f]/40 via-[#0b0f1f]/85 to-[#0b0f1f]" />
    <div className="mx-auto max-w-6xl px-5 pt-10">
      <p className="gx-eyebrow">WikiRush</p>
      <h1 className="gx-h mt-2 text-4xl sm:text-5xl">Choose your mission</h1>
      <p className="mt-2 max-w-xl text-white/70">Get from one Wikipedia page to another using only links.</p>
    </div>

    <div id="play" className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 space-y-6">
        <Lobby prefs={prefs} setPrefs={setPrefs} stats={stats} dailyKey={dailyKey} dailyScore={dailyScore} challenge={challenge}
          featured={featured} highlightId={featuredId} onStartFeatured={f => void startFeatured(f)} busy={busy} error={error} notice={notice} board={board} onStart={m => void start(m)} />
        {gate && !session && <div role="alert" className="gx-pop rounded-3xl bg-gradient-to-br from-[#6978f5] to-[#fb7185] p-6 text-white shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-white/80">Free game used</p>
          <h3 className="mt-1 text-2xl font-bold">Loved it? Make a free account to keep playing.</h3>
          <p className="mt-2 text-sm text-white/90">Your first game and score are already saved. They go straight onto your profile and the leaderboard when you sign up.</p>
        </div>}
        <div id="account"><AuthPanel key={gate ? 'gate' : 'open'} stream={stream} supabase={supabase} session={session} referralCode={referralCode} setReferralCode={setReferralCode} startInSignup={startInSignup || gate}
          onSession={(s, n) => { setSession(s); if (n) setNotice(n); }} /></div>
      </section>
      <aside className="space-y-4">
        {(() => {
          const local = pointsForGame(stats.totalScore);
          return !session?.user && local > 0 && configured
            ? <p className="gx-card p-4 text-sm font-semibold">You have <b className="text-[var(--gx-gold)]">{local.toLocaleString()} points</b> on this device{myRank ? ` (would rank #${myRank.toLocaleString()})` : ''}. Join free and they go on the leaderboard.</p>
            : null;
        })()}
        <PlayerCard />
        <TopPlayers />
        <div className="gx-card p-5">
          <h3 className="font-bold">Pro tips</h3>
          <ul className="mt-3 space-y-3 text-sm leading-relaxed text-white/70">
            <li>🌍 Climb to a hub first: countries, cities and years link to everything.</li>
            <li>🎯 Think about what the destination’s page links <em>from</em>: who, where, when.</li>
            <li>⏸️ The clock pauses while a page loads, so slow Wi-Fi isn’t punished.</li>
          </ul>
        </div>
      </aside>
    </div>

    {active && createPortal(<Game key={active.id} settings={active.settings} sound={prefs.sound}
      playerName={playerName} stream={stream} onBegin={() => void claimFreeGame()} challenge={active.settings.mode === 'challenge' ? challenge : null} onFinish={onFinish} onExit={exit} onPlayAgain={again} />, document.body)}
  </main>;
}
