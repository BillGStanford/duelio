import { seededRng, shuffled } from './rng';
import { HARD_TARGET_POOL, POP_STARTS, START_POOL, TARGET_POOL } from './pools';
import { normTitle } from './titles';
import { STARTER_GAMES, parseStarterSeed, starterPlans, starterSeedForGame } from './starters';
import { randomSeed } from './rng';

export type RoundPlan = {
  start: string;
  target: string;
  /** Fallbacks used when a primary title cannot be loaded or is a disambiguation page. */
  startAlts: string[];
  targetAlts: string[];
  /** A short, fun caption shown on the round intro (hand-picked rounds only). */
  blurb?: string;
};

/** Days are counted from the launch of the Daily Challenge (2026-10-23 is #1). */
export const DAILY_EPOCH = '2026-10-23';

export function dailySeed(dateKey: string): string {
  return `daily-${dateKey}`;
}

export function dailyNumber(dateKey: string): number {
  const a = Date.parse(`${DAILY_EPOCH}T00:00:00Z`);
  const b = Date.parse(`${dateKey}T00:00:00Z`);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export function utcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Seeds that start with `hard-` draw obscure starts and specific, non-hub destinations. */
export const HARD_PREFIX = 'hard-';
export const isHardSeed = (seed: string) => seed.startsWith(HARD_PREFIX);
/** Games after the starters before random games turn hard. */
export const WARMUP_GAMES = 3;

/**
 * Seed for a fresh classic game, by how many games this player has finished:
 * hand-picked fun pairs first, a few normal random games, then hard mode.
 */
export function freshSeed(gamesPlayed: number): string {
  const starter = starterSeedForGame(gamesPlayed);
  if (starter) return starter;
  return gamesPlayed >= STARTER_GAMES + WARMUP_GAMES ? `${HARD_PREFIX}${randomSeed()}` : randomSeed();
}

const PER_ROUND = 3; // one primary and two alternates per side

/**
 * Deterministic round plan: the same seed always returns the same pairs. Pairs never repeat
 * within a game and a start never equals its own target.
 */
export function planRounds(seed: string, count: number): RoundPlan[] {
  const starter = parseStarterSeed(seed);
  if (starter !== null) return starterPlans(starter, count);
  const rounds = Math.max(1, Math.min(5, Math.floor(count)));
  const hard = isHardSeed(seed);
  const rng = seededRng(`wikirush:${seed}`);
  const popular = new Set(POP_STARTS.map(normTitle));
  const starts = dedupe(shuffled(hard ? START_POOL.filter(t => !popular.has(normTitle(t))) : START_POOL, rng));
  const targets = dedupe(shuffled(hard ? HARD_TARGET_POOL : TARGET_POOL, rng));
  const plans: RoundPlan[] = [];
  for (let i = 0; i < rounds; i++) {
    const s = starts.slice(i * PER_ROUND, i * PER_ROUND + PER_ROUND);
    let t = targets.slice(i * PER_ROUND, i * PER_ROUND + PER_ROUND);
    if (normTitle(s[0]) === normTitle(t[0])) t = [t[1], t[0], t[2]];
    plans.push({ start: s[0], target: t[0], startAlts: s.slice(1), targetAlts: t.slice(1), ...(hard ? { blurb: '🔥 Hard mode: no hubs, expect detours.' } : {}) });
  }
  return plans;
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter(title => {
    const key = normTitle(title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
