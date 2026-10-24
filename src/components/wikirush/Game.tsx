'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import ArticleView, { type ArticleHandle } from './ArticleView';
import Confetti from './Confetti';
import { planRounds, type RoundPlan } from '@/lib/wikirush/rounds';
import { RADAR_PENALTY, maxScore, rankFor, scoreRound, scoreShare } from '@/lib/wikirush/scoring';
import { linkedTitles, normTitle } from '@/lib/wikirush/titles';
import { articles, resolveRound, resolveWildRound, wikipediaUrl, type LoadedRound } from '@/lib/wikirush/wiki';
import { buildChallengeUrl, buildShareText, emojiRow, formatScore, settingsLabel } from '@/lib/wikirush/share';
import { sfx } from '@/lib/wikirush/sfx';
import { clock, type OverlayState } from '@/lib/wikirush/overlay';
import { downloadRecording, type RecordingResult, type RunRecorder } from '@/lib/wikirush/recorder';
import { randomSeed } from '@/lib/wikirush/rng';
import { pointsForGame } from '@/lib/wikirush/levels';
import type { ChallengeParams, GameSettings, GameSummary, RoundResult } from '@/lib/wikirush/types';

type Phase = 'loading' | 'intro' | 'countdown' | 'playing' | 'roundEnd' | 'final' | 'error';
type RecState = { state: 'off' | 'recording' | 'saving' | 'done' | 'failed'; result?: RecordingResult; message?: string };

type Props = {
  settings: GameSettings;
  recorder: RunRecorder | null;
  overlayRef: MutableRefObject<OverlayState>;
  sound: boolean;
  playerName?: string;
  challenge?: ChallengeParams | null;
  stream?: boolean;
  /** Fires once, the moment play actually begins (after the countdown). */
  onBegin?(): void;
  onFinish(summary: GameSummary): Promise<string | void> | string | void;
  onExit(): void;
  onPlayAgain(settings: GameSettings): void;
};

function useCountUp(value: number, ms = 900, active = true) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!active) { setShown(value); return; }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; }
    let raf = 0; const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, active]);
  return shown;
}

export default function Game({ settings, recorder, overlayRef, sound, playerName, challenge, stream, onBegin, onFinish, onExit, onPlayAgain }: Props) {
  const limitMs = settings.seconds * 1000;
  const [phase, setPhase] = useState<Phase>('loading');
  const [roundIdx, setRoundIdx] = useState(0);
  const [round, setRound] = useState<LoadedRound | null>(null);
  const [page, setPage] = useState<{ title: string; html: string } | null>(null);
  const [trail, setTrail] = useState<string[]>([]);
  const [clicks, setClicks] = useState(0);
  const [msLeft, setMsLeft] = useState(limitMs);
  const [radarUsed, setRadarUsed] = useState(false);
  const [toast, setToast] = useState('');
  const [navBusy, setNavBusy] = useState(false);
  const [navSlow, setNavSlow] = useState(false);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState('');
  const [burst, setBurst] = useState(0);
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [rec, setRec] = useState<RecState>({ state: recorder ? 'recording' : 'off' });
  const [saveNote, setSaveNote] = useState('');
  const [confirmExit, setConfirmExit] = useState(false);
  const [showTarget, setShowTarget] = useState(false);
  const [copied, setCopied] = useState('');

  const onBeginRef = useRef(onBegin);
  onBeginRef.current = onBegin;
  const article = useRef<ArticleHandle>(null);
  const toastTimer = useRef<number | null>(null);
  const g = useRef({
    plans: [] as RoundPlan[],
    loads: new Map<number, Promise<LoadedRound>>(),
    used: new Set<string>(),
    stack: [] as string[],
    trail: [] as string[],
    clicks: 0,
    radar: false,
    startedAt: 0,
    paused: 0,
    pausedAt: null as number | null,
    live: false,
    ended: false,
    results: [] as RoundResult[],
    lastTickSecond: -1,
    finished: false,
    begun: false,
    round: null as LoadedRound | null,
  });

  const rounds = settings.rounds;

  useEffect(() => { sfx.setEnabled(sound); }, [sound]);

  // Hides site chrome that floats above the page (community button) while the game is open.
  useEffect(() => {
    document.documentElement.setAttribute('data-wr-game', '1');
    return () => document.documentElement.removeAttribute('data-wr-game');
  }, []);

  const say = useCallback((message: string, ms = 2600) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), ms);
  }, []);

  // ---------- loading ----------
  const load = useCallback((i: number): Promise<LoadedRound> => {
    const cache = g.current.loads;
    const hit = cache.get(i);
    if (hit) return hit;
    if (settings.mode !== 'wild' && !g.current.plans.length) {
      g.current.plans = settings.custom?.length
        ? settings.custom.map(c => ({ start: c.start, target: c.target, startAlts: [], targetAlts: [], blurb: c.blurb }))
        : planRounds(settings.seed || randomSeed(), rounds);
    }
    const p = settings.mode === 'wild' ? resolveWildRound(g.current.used) : resolveRound(g.current.plans[i]);
    const tracked = p.then(r => { g.current.used.add(normTitle(r.target.title)); return r; });
    tracked.catch(() => { cache.delete(i); });
    cache.set(i, tracked);
    return tracked;
  }, [settings.mode, settings.seed, settings.custom, rounds]);

  const openRound = useCallback(async (i: number) => {
    setPhase('loading'); setError(''); setRoundIdx(i);
    try {
      const r = await load(i);
      g.current.round = r;
      setRound(r); setRoundIdx(i); setMsLeft(limitMs);
      setPage({ title: r.start.title, html: r.startHtml });
      setTrail([r.start.title]); setClicks(0); setRadarUsed(false); setLastResult(null);
      void recorder?.setTargetThumb(r.target.thumbnail);
      setPhase('intro');
      if (i + 1 < rounds && settings.mode !== 'wild') void load(i + 1).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this round.');
      setPhase('error');
    }
  }, [load, limitMs, recorder, rounds, settings.mode]);

  useEffect(() => { void openRound(0); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Whatever page is on screen, quietly fetch the pages it links to, in reading order.
  useEffect(() => {
    if (!page) return;
    articles.prefetchMany(linkedTitles(page.html));
  }, [page]);

  // ---------- countdown ----------
  const beginCountdown = useCallback(() => {
    sfx.unlock();
    setPhase('countdown'); setCountdown(3); sfx.count();
  }, []);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      const r = g.current.round;
      if (!r) return;
      const s = g.current;
      s.stack = [r.start.title]; s.trail = [r.start.title]; s.clicks = 0; s.radar = false; s.paused = 0; s.pausedAt = null;
      s.ended = false; s.lastTickSecond = -1; s.live = true; s.startedAt = performance.now();
      sfx.go(); setPhase('playing');
      if (!s.begun) { s.begun = true; onBeginRef.current?.(); }
      return;
    }
    const id = window.setTimeout(() => { setCountdown(c => c - 1); if (countdown > 1) sfx.count(); }, 800);
    return () => window.clearTimeout(id);
  }, [phase, countdown]);

  // First time ever: one line that explains the whole game.
  useEffect(() => {
    if (phase !== 'playing') return;
    try {
      if (localStorage.getItem('wikirush:v2:coached')) return;
      localStorage.setItem('wikirush:v2:coached', '1');
      say('Click any blue link in the article to hop. Reach the 🎯 page to win.', 6500);
    } catch { /* storage blocked */ }
  }, [phase, say]);

  const elapsedNow = useCallback(() => {
    const s = g.current; const now = performance.now();
    return Math.max(0, now - s.startedAt - s.paused - (s.pausedAt !== null ? now - s.pausedAt : 0));
  }, []);

  // ---------- ending a round ----------
  const endRound = useCallback((ending: RoundResult['ending'], finalTitle?: string) => {
    const s = g.current;
    if (s.ended || !s.live || !s.round) return;
    s.ended = true; s.live = false;
    const target = s.round.target.title;
    const won = ending === 'arrived';
    const elapsed = Math.min(limitMs, elapsedNow());
    const path = won ? [...s.trail, finalTitle || target] : s.trail.slice();
    const near = !won && !!article.current?.linksTo(target);
    const base = { won, elapsedMs: won ? elapsed : Math.min(limitMs, elapsed), limitMs, clicks: Math.max(1, s.clicks), radar: s.radar, near };
    const result: RoundResult = {
      start: s.round.start.title, target, won, ending, elapsedMs: base.elapsedMs, limitMs, clicks: s.clicks,
      radar: s.radar, near, path, score: scoreRound(base).total,
    };
    s.results = [...s.results, result];
    setResults(s.results); setLastResult(result); setTrail(path); setPhase('roundEnd');
    if (won) { sfx.win(); setBurst(b => b + 1); } else sfx.lose();
  }, [elapsedNow, limitMs]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => {
      const left = Math.max(0, limitMs - elapsedNow());
      setMsLeft(left);
      const sec = Math.ceil(left / 1000);
      if (left <= 10000 && left > 0 && sec !== g.current.lastTickSecond) { g.current.lastTickSecond = sec; sfx.tick(); }
      if (left <= 0) endRound('timeout');
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, limitMs, elapsedNow, endRound]);

  // ---------- navigation ----------
  const go = useCallback(async (title: string, back = false) => {
    const s = g.current;
    if (!s.live || s.pausedAt !== null || !s.round) return;
    const key = normTitle(title);
    if (!back && key === normTitle(s.stack[s.stack.length - 1] || '')) return;
    sfx.click();
    // Instant arrival when the clicked title is the destination.
    if (key === normTitle(s.round.target.title)) {
      s.clicks += 1; setClicks(s.clicks);
      endRound('arrived', s.round.target.title);
      return;
    }
    // Prefetched pages open synchronously: no await, no pause, no flash of loading.
    const warm = articles.peek(title);
    if (warm) {
      s.clicks += 1; setClicks(s.clicks);
      if (normTitle(warm.title) === normTitle(s.round.target.title)) { endRound('arrived', s.round.target.title); return; }
      if (back) s.stack.pop(); else s.stack.push(warm.title);
      s.trail = [...s.trail, warm.title]; setTrail(s.trail);
      setPage({ title: warm.title, html: warm.html });
      return;
    }
    s.pausedAt = performance.now(); setNavBusy(true);
    const slowTimer = window.setTimeout(() => setNavSlow(true), 250);
    try {
      const art = await articles.get(title);
      const canonical = art.title; const html = art.html;
      if (s.pausedAt !== null) { s.paused += performance.now() - s.pausedAt; s.pausedAt = null; }
      s.clicks += 1; setClicks(s.clicks);
      if (normTitle(canonical) === normTitle(s.round.target.title)) { endRound('arrived', s.round.target.title); return; }
      if (back) s.stack.pop(); else s.stack.push(canonical);
      s.trail = [...s.trail, canonical]; setTrail(s.trail);
      setPage({ title: canonical, html });
    } catch (e) {
      if (s.pausedAt !== null) { s.paused += performance.now() - s.pausedAt; s.pausedAt = null; }
      say(e instanceof Error ? e.message : 'Could not open that page.');
    } finally { window.clearTimeout(slowTimer); setNavBusy(false); setNavSlow(false); }
  }, [endRound, say]);

  const navigate = useCallback((title: string) => { void go(title); }, [go]);
  const goBack = useCallback(() => {
    const s = g.current;
    if (s.stack.length < 2) { say('Nothing to go back to yet.'); return; }
    void go(s.stack[s.stack.length - 2], true);
  }, [go, say]);

  const fireRadar = useCallback(() => {
    const s = g.current;
    if (!s.live || !s.round) return;
    if (!s.radar) { s.radar = true; setRadarUsed(true); }
    sfx.radar();
    const found = article.current?.radar(s.round.target.title);
    say(found ? 'Target spotted. Follow the glow.' : 'Not linked from this page. Try a bigger hub.');
  }, [say]);

  // ---------- finishing ----------
  const finishGame = useCallback(() => {
    const s = g.current;
    if (s.finished) return;
    s.finished = true;
    const total = s.results.reduce((a, r) => a + r.score, 0);
    const sum: GameSummary = { settings, results: s.results, total, max: maxScore(rounds), finishedAt: new Date().toISOString() };
    setSummary(sum); setPhase('final'); sfx.final(); setBurst(b => b + 1);
    Promise.resolve(onFinish(sum)).then(note => { if (note) setSaveNote(note); }).catch(() => {});
    if (recorder) {
      setRec({ state: 'saving' });
      recorder.finish(sum).then(result => {
        if (result) setRec({ state: 'done', result }); // the popup on the results screen asks whether to download
        else setRec({ state: 'failed', message: 'Nothing was recorded.' });
      }).catch(e => setRec({ state: 'failed', message: e instanceof Error ? e.message : 'Recording failed.' }));
    }
  }, [onFinish, recorder, rounds, settings]);

  const nextRound = useCallback(() => {
    if (roundIdx + 1 < rounds) void openRound(roundIdx + 1); else finishGame();
  }, [finishGame, openRound, roundIdx, rounds]);

  // Recorder stopped from the browser's own "Stop sharing" bar: keep playing, drop the footage.
  useEffect(() => {
    if (!recorder) return;
    recorder.onEndedEarly = () => { setRec({ state: 'failed', message: 'Screen sharing was stopped, so this run was not recorded.' }); recorder.cancel(); };
    return () => { recorder.onEndedEarly = undefined; };
  }, [recorder]);

  useEffect(() => () => { if (recorder && !g.current.finished) recorder.cancel(); }, [recorder]);

  // Keyboard: Enter advances between rounds.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || confirmExit) return;
      if (phase === 'intro') beginCountdown();
      else if (phase === 'roundEnd') nextRound();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, beginCountdown, nextRound, confirmExit]);

  // ---------- overlay state for the recorder ----------
  useEffect(() => {
    overlayRef.current = {
      phase: phase === 'loading' || phase === 'error' ? 'idle' : phase,
      modeLabel: settingsLabel(settings),
      roundIdx, rounds,
      startTitle: round?.start.title ?? '', targetTitle: round?.target.title ?? '', targetDesc: round?.target.description,
      currentTitle: page?.title ?? '', msLeft, limitMs, clicks, path: trail,
      totalScore: results.reduce((a, r) => a + r.score, 0), countdown, lastResult, summary,
    };
  });

  // ---------- derived ----------
  const total = results.reduce((a, r) => a + r.score, 0);
  const frac = Math.max(0, Math.min(1, msLeft / limitMs));
  const low = msLeft <= 10000;
  const barColor = low ? 'bg-red-500' : frac < 0.3 ? 'bg-amber-400' : 'bg-[#6978f5]';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://duelio.ink';

  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    setCopied(label); window.setTimeout(() => setCopied(''), 2000);
  }

  async function shareResult() {
    if (!summary) return;
    const text = buildShareText({ summary, origin, playerName, link: settings.featuredId ? `${origin}/wikirush?f=${settings.featuredId}` : undefined });
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ text }); return; } catch (e) { if ((e as Error)?.name === 'AbortError') return; }
    }
    await copy(text, 'result');
  }

  const challengeLink = useMemo(() => {
    if (!summary || !settings.seed) return '';
    if (settings.mode === 'daily') return `${origin}/wikirush`;
    if (settings.featuredId) return `${origin}/wikirush?f=${settings.featuredId}`;
    return buildChallengeUrl(origin, { seed: settings.seed, seconds: settings.seconds, rounds: settings.rounds, score: summary.total, name: playerName });
  }, [origin, playerName, settings.featuredId, settings.mode, settings.rounds, settings.seconds, settings.seed, summary]);

  const chatText = useMemo(() => {
    if (!summary) return '';
    const link = challengeLink || `${origin}/wikirush`;
    return `I scored ${formatScore(summary.total)} on WikiRush. Same pages, beat me: ${link}`;
  }, [challengeLink, origin, summary]);
  const cardUrl = summary ? `/wikirush/og?fmt=story&dl=1&r=${summary.settings.rounds}&s=${summary.total}${playerName ? `&n=${encodeURIComponent(playerName)}` : ''}` : '';

  // ---------- render ----------
  const frame = 'fixed inset-0 z-[100] flex flex-col bg-[#101426] text-white';
  // Quitting before play begins is free: no score, no streak, and the free game is not used up.
  const quitX = <button type="button" onClick={onExit} aria-label="Quit before the game starts" title="Quit (nothing is counted)"
    className="absolute right-3 top-3 z-[60] grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-white/10 text-2xl font-black leading-none text-white hover:bg-white/25">×</button>;

  if (phase === 'loading' || phase === 'error') {
    return <div className={frame} role="dialog" aria-modal="true" aria-label="WikiRush">
      {quitX}
      <div className="m-auto max-w-md px-6 text-center">
        {phase === 'loading' ? <>
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-white/15 border-t-[#aeb7ff]" />
          <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-[#aeb7ff]">Round {Math.min(roundIdx + 1, rounds)} of {rounds}</p>
          <h2 className="mt-2 text-2xl font-black">Finding two real pages…</h2>
          <p className="mt-2 text-sm text-white/60">Pulling live articles from Wikipedia.</p>
        </> : <>
          <p className="text-5xl">🛰️</p>
          <h2 className="mt-4 text-2xl font-black">Lost signal</h2>
          <p className="mt-2 text-sm text-white/70">{error}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => void openRound(roundIdx)} className="rounded-xl bg-[#6978f5] px-5 py-3 font-extrabold">Try again</button>
            <button onClick={onExit} className="rounded-xl border border-white/20 px-5 py-3 font-bold">Back to lobby</button>
          </div>
        </>}
      </div>
    </div>;
  }

  if (phase === 'final' && summary) {
    return <FinalScreen
      summary={summary} rec={rec} saveNote={saveNote} challenge={challenge} burst={burst} copied={copied}
      playerName={playerName} challengeLink={challengeLink} stream={!!stream}
      chatText={chatText} onChat={() => void copy(chatText, 'chat')} cardUrl={cardUrl}
      onShare={shareResult} onCopyLink={() => void copy(challengeLink, 'link')}
      onAgain={() => onPlayAgain(settings.mode === 'daily' || !settings.seed ? settings : { ...settings, custom: undefined, featuredId: undefined, mode: 'classic', seed: 'new' })}
      onSameSeed={() => onPlayAgain({ ...settings })}
      onExit={onExit}
    />;
  }

  const target = round?.target;
  return <div className={frame} role="dialog" aria-modal="true" aria-label="WikiRush game">
    {/* HUD */}
    <header className="relative z-20 border-b border-white/10 bg-[#101426] px-3 pb-2 pt-2 sm:px-5">
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={() => setConfirmExit(true)} aria-label="Leave game" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 text-lg text-white/80 hover:bg-white/10">✕</button>
        <div className="hidden shrink-0 rounded-xl bg-white/10 px-3 py-2 text-center sm:block">
          <p className="text-[9px] font-black uppercase tracking-widest text-white/50">Round</p>
          <p className="text-sm font-black leading-none">{roundIdx + 1}/{rounds}</p>
        </div>
        <button onClick={() => setShowTarget(v => !v)} aria-expanded={showTarget} className="relative flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-[#6978f5]/50 bg-[#6978f5]/15 px-3 py-1.5 text-left">
          {target?.thumbnail
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={target.thumbnail} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
            : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 text-lg">🎯</span>}
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[.18em] text-[#aeb7ff]">Find this page</span>
            <span className="block truncate text-base font-black leading-tight sm:text-lg">{target?.title}</span>
          </span>
          <span className="ml-auto hidden text-xs font-bold text-white/50 sm:block">{showTarget ? 'Hide' : 'Details'}</span>
        </button>
        {rec.state === 'recording' && <span role="status" className="shrink-0 self-center rounded-full bg-rose-500/90 px-2.5 py-1 text-[10px] font-black tracking-widest"><span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-white" />REC</span>}
        <div className={`shrink-0 rounded-xl px-3 py-1.5 text-right ${low && phase === 'playing' ? 'bg-red-500/20 text-red-200' : 'bg-white/10'}`} aria-live="off">
          <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Time</p>
          <p className="text-2xl font-black tabular-nums leading-none">{clock(msLeft)}</p>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full transition-[width] duration-100 ${barColor}`} style={{ width: `${frac * 100}%` }} /></div>
      {showTarget && target && <div className="wr-rise absolute inset-x-3 top-full mt-2 rounded-2xl border border-white/10 bg-[#171c33] p-4 shadow-2xl sm:left-auto sm:w-[420px]">
        <p className="text-sm font-black">{target.title}</p>
        {target.description && <p className="text-xs text-[#aeb7ff]">{target.description}</p>}
        <p className="mt-2 line-clamp-5 text-sm leading-relaxed text-white/75">{target.extract}</p>
      </div>}
      <nav aria-label="Your trail" className="mt-2 flex items-center gap-1 overflow-x-auto whitespace-nowrap pb-0.5 text-xs text-white/60">
        {trail.slice(-6).map((t, i, arr) => <span key={`${t}-${i}`} className="flex items-center gap-1">
          {i > 0 && <span className="text-white/30">›</span>}
          <span className={i === arr.length - 1 ? 'rounded-full bg-white/15 px-2 py-0.5 font-bold text-white' : ''}>{t}</span>
        </span>)}
        {trail.length > 6 && <span className="ml-1 text-white/40">· +{trail.length - 6} earlier</span>}
      </nav>
    </header>

    {/* Article */}
    <div className="relative flex min-h-0 flex-1 flex-col">
      {page && <ArticleView ref={article} title={page.title} html={page.html} disabled={phase !== 'playing' || navBusy} onNavigate={navigate} onHint={articles.hint} onBlocked={say} />}
      {navBusy && <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 overflow-hidden bg-[#6978f5]/20"><div className="h-full w-1/3 animate-pulse bg-[#6978f5]" /></div>}
      {navSlow && <p className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-[#101426]/90 px-3 py-1 text-xs font-bold text-white">Clock paused while the page loads</p>}

      {/* Bottom action bar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-3 pb-3 sm:pb-4">
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/10 bg-[#101426]/95 p-1.5 shadow-2xl backdrop-blur">
          <button onClick={goBack} disabled={phase !== 'playing' || navBusy} className="rounded-xl px-3 py-2.5 text-sm font-extrabold hover:bg-white/10 disabled:opacity-40">← Back</button>
          <button onClick={fireRadar} disabled={phase !== 'playing'} className={`rounded-xl px-3 py-2.5 text-sm font-extrabold hover:bg-white/10 disabled:opacity-40 ${radarUsed ? 'text-amber-300' : ''}`}>
            📡 Radar{!radarUsed && <span className="ml-1 text-[10px] font-bold text-white/50">−{RADAR_PENALTY}</span>}
          </button>
          <button onClick={() => endRound('gave-up')} disabled={phase !== 'playing'} className="rounded-xl px-3 py-2.5 text-sm font-extrabold text-white/60 hover:bg-white/10 disabled:opacity-40">Skip</button>
          <span className="mx-1 hidden h-6 w-px bg-white/15 sm:block" />
          <span className="hidden px-2 text-xs font-bold text-white/60 sm:block">{clicks} click{clicks === 1 ? '' : 's'} · {formatScore(total)} pts</span>
        </div>
      </div>

      {toast && <p role="status" className="wr-pop pointer-events-none absolute bottom-20 left-1/2 z-20 max-w-[90%] -translate-x-1/2 rounded-full bg-white px-4 py-2 text-center text-sm font-extrabold text-[#101426] shadow-xl">{toast}</p>}
    </div>

    {/* Intro */}
    {phase === 'intro' && round && <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[#101426]/95 p-4 backdrop-blur-sm">
      {quitX}
      <div className="wr-rise w-full max-w-2xl text-center">
        <p className="text-xs font-black uppercase tracking-[.22em] text-[#aeb7ff]">Round {roundIdx + 1} of {rounds} · {settingsLabel(settings)}</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Get from here…</h2>
        <PageCard page={round.start} tone="start" />
        <p className="my-3 text-3xl text-[#aeb7ff]">↓</p>
        <h2 className="text-3xl font-black tracking-tight sm:text-5xl">…to there.</h2>
        <PageCard page={round.target} tone="target" />
        {round.blurb && <p className="wr-pop mx-auto mt-4 max-w-md rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-amber-200">{round.blurb}</p>}
        <p className="mx-auto mt-5 max-w-md text-sm text-white/60">Links only. No search. The clock pauses while pages load.</p>
        <button autoFocus onClick={beginCountdown} className="mt-5 rounded-2xl bg-[#6978f5] px-10 py-4 text-lg font-black shadow-lg shadow-[#6978f5]/30 hover:bg-[#5866df]">I’m ready →</button>
        <p className="mt-2 text-xs text-white/40">or press Enter</p>
      </div>
    </div>}

    {/* Countdown */}
    {phase === 'countdown' && <div className="absolute inset-0 z-30 grid place-items-center bg-[#101426]/80 backdrop-blur-sm" aria-live="assertive">
      {quitX}
      <p key={countdown} className="wr-pop text-[10rem] font-black leading-none text-white sm:text-[14rem]">{countdown > 0 ? countdown : 'GO'}</p>
    </div>}

    {/* Round end */}
    {phase === 'roundEnd' && lastResult && round && <RoundEnd
      result={lastResult} round={round} roundIdx={roundIdx} rounds={rounds} total={total} burst={burst}
      onNext={nextRound}
    />}

    {confirmExit && <div className="absolute inset-0 z-40 grid place-items-center bg-black/60 p-4">
      <div role="alertdialog" aria-label="Leave game" className="wr-pop w-full max-w-sm rounded-3xl bg-white p-6 text-[#101426]">
        <h3 className="text-xl font-black">Leave this run?</h3>
        <p className="mt-2 text-sm text-slate-600">Your progress and any recording will be discarded.</p>
        <div className="mt-5 flex gap-3">
          <button autoFocus onClick={() => setConfirmExit(false)} className="flex-1 rounded-xl bg-[#101426] px-4 py-3 font-extrabold text-white">Keep playing</button>
          <button onClick={() => { recorder?.cancel(); onExit(); }} className="rounded-xl border border-slate-300 px-4 py-3 font-bold">Leave</button>
        </div>
      </div>
    </div>}
  </div>;
}

function canShareFile(r: { blob: Blob; filename: string }): boolean {
  try { return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([r.blob], r.filename, { type: r.blob.type })] }); } catch { return false; }
}

async function shareVideo(r: { blob: Blob; filename: string }) {
  try { await navigator.share({ files: [new File([r.blob], r.filename, { type: r.blob.type })], title: 'My WikiRush run' }); } catch { /* cancelled */ }
}

function PageCard({ page, tone }: { page: LoadedRound['start']; tone: 'start' | 'target' }) {
  return <div className={`mx-auto mt-4 flex max-w-xl items-center gap-4 rounded-3xl border p-4 text-left ${tone === 'target' ? 'border-[#e75d87]/60 bg-[#e75d87]/10' : 'border-white/15 bg-white/[.06]'}`}>
    {page.thumbnail
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={page.thumbnail} alt="" className="h-24 w-24 shrink-0 rounded-2xl object-cover sm:h-28 sm:w-28" />
      : <span className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-white/10 text-4xl sm:h-28 sm:w-28">{tone === 'target' ? '🎯' : '📄'}</span>}
    <div className="min-w-0">
      <p className={`text-[10px] font-black uppercase tracking-[.2em] ${tone === 'target' ? 'text-[#f9a8c4]' : 'text-[#aeb7ff]'}`}>{tone === 'target' ? 'Destination' : 'Start'}</p>
      <h3 className="text-2xl font-black leading-tight sm:text-3xl">{page.title}</h3>
      {page.description && <p className="mt-0.5 text-sm font-semibold text-white/60">{page.description}</p>}
      <p className="mt-2 line-clamp-2 text-sm leading-snug text-white/70">{page.extract}</p>
    </div>
  </div>;
}

function RoundEnd({ result, round, roundIdx, rounds, total, burst, onNext }: { result: RoundResult; round: LoadedRound; roundIdx: number; rounds: number; total: number; burst: number; onNext(): void }) {
  const shown = useCountUp(result.score, 800);
  const b = scoreRound({ won: result.won, elapsedMs: result.elapsedMs, limitMs: result.limitMs, clicks: Math.max(1, result.clicks), radar: result.radar, near: result.near });
  const last = roundIdx + 1 >= rounds;
  const headline = result.won ? 'You made it!' : result.ending === 'gave-up' ? 'Skipped' : 'Time’s up';
  const rows: Array<[string, number]> = result.won
    ? [['Arrival', b.arrival], [`Speed · ${(result.elapsedMs / 1000).toFixed(1)}s`, b.speed], [`Efficiency · ${result.clicks} click${result.clicks === 1 ? '' : 's'}`, b.efficiency], ...(result.radar ? [['Radar used', b.radar] as [string, number]] : [])]
    : result.near ? [['So close: the last page linked to it', b.nearMiss]] : [['No arrival', 0]];
  return <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[#101426]/95 p-4 backdrop-blur-sm">
    <Confetti burst={result.won ? burst : 0} />
    <div className="wr-pop relative z-20 w-full max-w-lg rounded-[28px] bg-white p-6 text-[#101426] shadow-2xl sm:p-8">
      <p className="text-center text-xs font-black uppercase tracking-[.2em] text-[#6978f5]">Round {roundIdx + 1} of {rounds}</p>
      <h2 className={`mt-2 text-center text-4xl font-black tracking-tight ${result.won ? 'text-emerald-600' : result.near ? 'text-amber-600' : 'text-rose-600'}`}>{headline}</h2>
      <p className="mt-2 text-center text-6xl font-black tabular-nums">+{formatScore(shown)}</p>
      <ul className="mt-5 space-y-1.5 text-sm">
        {rows.map(([label, pts]) => <li key={label} className="flex justify-between rounded-xl bg-slate-50 px-4 py-2.5 font-bold"><span className="text-slate-600">{label}</span><span className={pts < 0 ? 'text-rose-600' : ''}>{pts > 0 ? '+' : ''}{formatScore(pts)}</span></li>)}
      </ul>
      <div className="mt-4 rounded-2xl border border-slate-200 p-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Your route · {result.path.length - 1} hop{result.path.length === 2 ? '' : 's'}</p>
        <p className="mt-1 text-sm font-semibold leading-relaxed">{result.path.join(' → ')}</p>
      </div>
      <div className="mt-3 flex items-start gap-3 rounded-2xl bg-[#f4f5ff] p-3">
        {round.target.thumbnail
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={round.target.thumbnail} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : null}
        <div className="min-w-0 text-sm">
          <p className="font-black">{round.target.title}</p>
          <p className="line-clamp-2 text-slate-600">{round.target.extract}</p>
          <a href={wikipediaUrl(round.target.title)} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#4857d7] underline">Read on Wikipedia ↗</a>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-500">Total {formatScore(total)}</p>
        <button autoFocus onClick={onNext} className="rounded-2xl bg-[#101426] px-7 py-3.5 font-black text-white hover:bg-[#1c2240]">{last ? 'See results →' : 'Next round →'}</button>
      </div>
    </div>
  </div>;
}

function FinalScreen({ summary, rec, saveNote, challenge, burst, copied, playerName, challengeLink, stream, chatText, onChat, cardUrl, onShare, onCopyLink, onAgain, onSameSeed, onExit }: {
  summary: GameSummary; rec: RecState; saveNote: string; challenge?: ChallengeParams | null; burst: number; copied: string; playerName?: string; challengeLink: string; stream: boolean; chatText: string; onChat(): void; cardUrl: string;
  onShare(): void; onCopyLink(): void; onAgain(): void; onSameSeed(): void; onExit(): void;
}) {
  const [popupClosed, setPopupClosed] = useState(false);
  const rank = rankFor(summary.total, summary.max);
  const shown = useCountUp(summary.total, 1400);
  const pct = Math.round(scoreShare(summary.total, summary.max) * 100);
  const vs = challenge?.score !== undefined ? summary.total - challenge.score : null;
  const rival = challenge?.name || 'your friend';
  const wins = summary.results.filter(r => r.won).length;
  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#101426] text-white" role="dialog" aria-modal="true" aria-label="WikiRush results">
    <Confetti burst={burst} big />
    {rec.state !== 'off' && !popupClosed && (rec.state === 'recording' || rec.state === 'saving' || rec.state === 'done') && <div className="fixed inset-0 z-[130] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Your recording">
      <div className="wr-pop w-full max-w-lg rounded-3xl bg-white p-5 text-[#101426] shadow-2xl">
        {rec.state === 'done' && rec.result ? <>
          <p className="text-xs font-black uppercase tracking-widest text-[#5968ec]">🎥 Your recording is ready</p>
          <h3 className="mt-1 text-2xl font-black">Download your video?</h3>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={rec.result.url} controls autoPlay muted loop playsInline className="mt-3 max-h-[50vh] w-full rounded-xl bg-black" />
          <p className="mt-2 text-xs text-slate-500">{rec.result.filename} · {(rec.result.bytes / 1048576).toFixed(1)} MB · with the WikiRush overlay</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button autoFocus onClick={() => { downloadRecording(rec.result!); setPopupClosed(true); }} className="rounded-xl bg-[#6978f5] px-4 py-3 font-black text-white hover:bg-[#5866df]">⬇ Download</button>
            {canShareFile(rec.result) ? <button onClick={() => void shareVideo(rec.result!)} className="rounded-xl border border-slate-300 px-4 py-3 font-black hover:bg-slate-50">Share ↗</button> : <button onClick={() => setPopupClosed(true)} className="rounded-xl border border-slate-300 px-4 py-3 font-black hover:bg-slate-50">No thanks</button>}
          </div>
          {canShareFile(rec.result) && <button onClick={() => setPopupClosed(true)} className="mx-auto mt-3 block text-sm font-bold text-slate-500 underline">No thanks</button>}
        </> : <div className="py-6 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#6978f5]" />
          <h3 className="mt-4 text-xl font-black">Finishing your video…</h3>
          <p className="mt-1 text-sm text-slate-500">Adding the WikiRush outro. This takes a few seconds.</p>
          <button onClick={() => setPopupClosed(true)} className="mt-4 text-sm font-bold text-slate-500 underline">Hide</button>
        </div>}
      </div>
    </div>}
    <div className="relative z-20 mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <p className="text-center text-xs font-black uppercase tracking-[.22em] text-[#aeb7ff]">{summary.settings.mode === 'daily' ? 'Daily challenge' : 'Run complete'} · {settingsLabel(summary.settings)}</p>
      <p className="mt-4 text-center text-7xl font-black tabular-nums tracking-tight sm:text-8xl">{formatScore(shown)}</p>
      <p className="text-center text-sm font-bold text-white/50">out of {formatScore(summary.max)} · {pct}%</p>
      <p className="wr-pop mt-3 text-center text-lg font-black text-amber-200">⭐ +{pointsForGame(summary.total).toLocaleString()} points</p>
      <div className="mt-4 text-center"><span className="wr-pop inline-block rounded-full bg-amber-300 px-5 py-2 text-lg font-black text-[#101426]">{rank.title}</span><p className="mx-auto mt-2 max-w-sm text-sm text-white/65">{rank.blurb}</p></div>
      <p className="mt-4 text-center text-3xl tracking-widest" aria-label={`${wins} of ${summary.results.length} pages reached`}>{emojiRow(summary.results)}</p>
      {vs !== null && <p className={`mx-auto mt-4 max-w-md rounded-2xl px-4 py-3 text-center text-sm font-extrabold ${vs > 0 ? 'bg-emerald-400/15 text-emerald-200' : vs < 0 ? 'bg-rose-400/15 text-rose-200' : 'bg-white/10'}`}>
        {vs > 0 ? `You beat ${rival}'s ${formatScore(challenge!.score!)} by ${formatScore(vs)}.` : vs < 0 ? `${rival} still leads: ${formatScore(challenge!.score!)}. You're ${formatScore(-vs)} behind.` : `A dead heat with ${rival}.`}
      </p>}

      <ol className="mt-6 space-y-2">
        {summary.results.map((r, i) => <li key={i} className="rounded-2xl border border-white/10 bg-white/[.05] p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-extrabold">{r.won ? '✅' : r.near ? '🟧' : '❌'} {r.start} → {r.target}</p>
            <p className="shrink-0 text-lg font-black tabular-nums">{formatScore(r.score)}</p>
          </div>
          <p className="mt-1 text-xs text-white/50">{r.won ? `${(r.elapsedMs / 1000).toFixed(1)}s · ${r.clicks} click${r.clicks === 1 ? '' : 's'}${r.radar ? ' · radar' : ''}` : r.ending === 'gave-up' ? 'Skipped' : r.near ? 'Timed out one click away' : 'Timed out'}</p>
          <p className="mt-1 text-xs leading-relaxed text-white/40">{r.path.join(' → ')}</p>
        </li>)}
      </ol>

      {rec.state !== 'off' && <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.05] p-4">
        <p className="text-xs font-black uppercase tracking-widest text-[#aeb7ff]">🎥 Your recording</p>
        {rec.state === 'recording' || rec.state === 'saving' ? <p className="mt-2 text-sm text-white/70">Finishing your video with the Duelio outro… a Download popup appears when it is ready.</p> : null}
        {rec.state === 'failed' && <p className="mt-2 text-sm text-rose-200">{rec.message || 'Recording failed.'}</p>}
        {rec.state === 'done' && rec.result && <>
          <p className="mt-2 text-sm text-white/70">Saved <span className="font-bold text-white">{rec.result.filename}</span> · {(rec.result.bytes / 1048576).toFixed(1)} MB. Ready whenever you are.</p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={rec.result.url} controls playsInline className="mt-3 max-h-80 w-full rounded-xl bg-black" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => downloadRecording(rec.result!)} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold hover:bg-white/10">Download ↓</button>
            {canShareFile(rec.result) && <button onClick={() => void shareVideo(rec.result!)} className="rounded-xl bg-[#6978f5] px-4 py-2.5 text-sm font-bold hover:bg-[#5866df]">Share video ↗</button>}
          </div>
        </>}
      </div>}

      {saveNote && <p role="status" className="mt-4 text-center text-sm text-white/60">{saveNote}</p>}

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <button onClick={onShare} className="rounded-2xl bg-[#6978f5] px-5 py-4 text-base font-black hover:bg-[#5866df]">{copied === 'result' ? 'Copied ✓' : 'Share result'}</button>
        <button onClick={onCopyLink} disabled={!challengeLink} className="rounded-2xl border border-white/20 px-5 py-4 text-base font-black hover:bg-white/10 disabled:opacity-40">{copied === 'link' ? 'Link copied ✓' : summary.settings.mode === 'daily' ? 'Copy daily link' : 'Challenge a friend'}</button>
        <button onClick={onAgain} className="rounded-2xl border border-white/20 px-5 py-4 text-base font-black hover:bg-white/10">{summary.settings.mode === 'daily' ? 'Practice round again' : 'New pages ↻'}</button>
        <button onClick={onSameSeed} disabled={!summary.settings.seed} className="rounded-2xl border border-white/20 px-5 py-4 text-base font-black hover:bg-white/10 disabled:opacity-40">Replay these pages</button>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <button onClick={onChat} className={`rounded-2xl border px-5 py-3 text-sm font-black hover:bg-white/10 ${stream ? 'border-amber-300/70 text-amber-100' : 'border-white/20'}`}>{copied === 'chat' ? 'Copied for chat ✓' : '💬 Copy for chat'}</button>
        <a href={cardUrl} download="wikirush-score.png" className="rounded-2xl border border-white/20 px-5 py-3 text-center text-sm font-black hover:bg-white/10">🖼️ Download score card</a>
      </div>
      <button onClick={onExit} className="mx-auto mt-5 block text-sm font-bold text-white/60 underline">Back to lobby</button>
      <span className="sr-only">{playerName}</span>
    </div>
  </div>;
}
