import type { GameSummary } from './types';
import { utcDateKey } from './rounds';

export type WikiStats = {
  games: number;
  rounds: number;
  wins: number;
  totalScore: number;
  bestScore: number;
  bestRound: number;
  fastestMs: number | null;
  dailyStreak: number;
  bestDailyStreak: number;
  lastDaily: string | null;
  /** date key -> score, last 30 dailies */
  daily: Record<string, number>;
};

export const EMPTY_STATS: WikiStats = {
  games: 0, rounds: 0, wins: 0, totalScore: 0, bestScore: 0, bestRound: 0, fastestMs: null,
  dailyStreak: 0, bestDailyStreak: 0, lastDaily: null, daily: {},
};

const KEY = 'wikirush:v2:stats';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function previousDay(key: string): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
}

export function applyGame(stats: WikiStats, game: GameSummary): WikiStats {
  const wins = game.results.filter(r => r.won);
  const fastest = wins.reduce<number | null>((best, r) => (best === null || r.elapsedMs < best ? r.elapsedMs : best), stats.fastestMs);
  const next: WikiStats = {
    ...stats,
    games: stats.games + 1,
    rounds: stats.rounds + game.results.length,
    wins: stats.wins + wins.length,
    totalScore: stats.totalScore + game.total,
    // Best score only compares full five-round games so a one-round practice never skews it.
    bestScore: game.settings.rounds === 5 ? Math.max(stats.bestScore, game.total) : stats.bestScore,
    bestRound: Math.max(stats.bestRound, ...game.results.map(r => r.score)),
    fastestMs: fastest,
    daily: { ...stats.daily },
  };
  if (game.settings.mode === 'daily') {
    const key = (game.settings.seed || '').replace(/^daily-/, '') || utcDateKey();
    if (stats.lastDaily !== key) {
      const streak = stats.lastDaily === previousDay(key) ? stats.dailyStreak + 1 : 1;
      next.dailyStreak = streak;
      next.bestDailyStreak = Math.max(stats.bestDailyStreak, streak);
      next.lastDaily = key;
    }
    next.daily[key] = Math.max(next.daily[key] ?? 0, game.total);
    const keys = Object.keys(next.daily).sort();
    for (const old of keys.slice(0, Math.max(0, keys.length - 30))) delete next.daily[old];
  }
  return next;
}

/** A broken streak (last daily older than yesterday) reads as 0 even before the next game. */
export function liveDailyStreak(stats: WikiStats, today: string = utcDateKey()): number {
  if (!stats.lastDaily) return 0;
  return stats.lastDaily === today || stats.lastDaily === previousDay(today) ? stats.dailyStreak : 0;
}

export function loadStats(storage?: StorageLike | null): WikiStats {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    const raw = s?.getItem(KEY);
    if (!raw) return { ...EMPTY_STATS, daily: {} };
    return { ...EMPTY_STATS, ...JSON.parse(raw), daily: { ...(JSON.parse(raw).daily || {}) } };
  } catch {
    return { ...EMPTY_STATS, daily: {} };
  }
}

export function saveStats(stats: WikiStats, storage?: StorageLike | null) {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    s?.setItem(KEY, JSON.stringify(stats));
  } catch { /* private mode or full storage: stats are a nicety */ }
}

const PREF_KEY = 'wikirush:v2:prefs';
export type WikiPrefs = { rounds: number; seconds: number; sound: boolean; name: string };
export const DEFAULT_PREFS: WikiPrefs = { rounds: 5, seconds: 90, sound: true, name: '' };

export function loadPrefs(): WikiPrefs {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PREF_KEY) : null;
    const stored = raw ? JSON.parse(raw) : null;
    // Drop fields from older versions (recording was removed) so they never linger in storage.
    return { rounds: DEFAULT_PREFS.rounds, seconds: DEFAULT_PREFS.seconds, sound: DEFAULT_PREFS.sound, name: DEFAULT_PREFS.name, ...(stored && typeof stored === 'object' ? { rounds: stored.rounds ?? DEFAULT_PREFS.rounds, seconds: stored.seconds ?? DEFAULT_PREFS.seconds, sound: stored.sound ?? DEFAULT_PREFS.sound, name: stored.name ?? DEFAULT_PREFS.name } : {}) };
  } catch { return { ...DEFAULT_PREFS }; }
}

export function savePrefs(p: WikiPrefs) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
