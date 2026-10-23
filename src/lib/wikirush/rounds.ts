import { seededRng, shuffled } from './rng';
import { START_POOL, TARGET_POOL } from './pools';
import { normTitle } from './titles';

export type RoundPlan = {
  start: string;
  target: string;
  /** Fallbacks used when a primary title cannot be loaded or is a disambiguation page. */
  startAlts: string[];
  targetAlts: string[];
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

const PER_ROUND = 3; // one primary and two alternates per side

/**
 * Deterministic round plan: the same seed always returns the same pairs. Pairs never repeat
 * within a game and a start never equals its own target.
 */
export function planRounds(seed: string, count: number): RoundPlan[] {
  const rounds = Math.max(1, Math.min(5, Math.floor(count)));
  const rng = seededRng(`wikirush:${seed}`);
  const starts = dedupe(shuffled(START_POOL, rng));
  const targets = dedupe(shuffled(TARGET_POOL, rng));
  const plans: RoundPlan[] = [];
  const onboarding = seed.match(/^onboarding-([01])$/);
  const easyPairs: Array<[string, string]> = [
    ['Melania Trump', 'Mars'],
    ['Pluto', 'Taylor Swift'],
  ];
  for (let i = 0; i < rounds; i++) {
    if (i === 0 && onboarding) {
      const [start, target] = easyPairs[Number(onboarding[1])];
      plans.push({ start, target, startAlts: ['Donald Trump', 'United States'], targetAlts: ['Solar System', 'Earth'] });
      continue;
    }
    const s = starts.slice(i * PER_ROUND, i * PER_ROUND + PER_ROUND);
    let t = targets.slice(i * PER_ROUND, i * PER_ROUND + PER_ROUND);
    if (normTitle(s[0]) === normTitle(t[0])) t = [t[1], t[0], t[2]];
    plans.push({ start: s[0], target: t[0], startAlts: s.slice(1), targetAlts: t.slice(1) });
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
