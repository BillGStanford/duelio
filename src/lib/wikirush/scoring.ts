// Round scoring. Everything is integer math so the Postgres function in
// supabase/wikirush-v2.sql can recompute exactly the same numbers server-side.

export const ROUND_MAX = 5000;
export const ARRIVAL_POINTS = 2000;
export const SPEED_POINTS = 2000;
export const EFFICIENCY_POINTS = 1000;
export const RADAR_PENALTY = 600;
export const NEAR_MISS_POINTS = 600;

export type RoundOutcome = {
  won: boolean;
  elapsedMs: number;
  limitMs: number;
  clicks: number;
  radar: boolean;
  near: boolean;
};

export type ScoreBreakdown = {
  arrival: number;
  speed: number;
  efficiency: number;
  radar: number; // negative or zero
  nearMiss: number;
  total: number;
};

export function scoreRound(o: RoundOutcome): ScoreBreakdown {
  if (!o.won) {
    const nearMiss = o.near ? NEAR_MISS_POINTS : 0;
    return { arrival: 0, speed: 0, efficiency: 0, radar: 0, nearMiss, total: nearMiss };
  }
  const limit = Math.max(1, o.limitMs);
  const left = Math.min(limit, Math.max(0, limit - Math.max(0, o.elapsedMs)));
  const speed = Math.floor((SPEED_POINTS * left) / limit);
  const clicks = Math.max(1, Math.floor(o.clicks));
  const efficiency = 100 * Math.min(10, Math.max(0, 12 - clicks));
  const radar = o.radar ? -RADAR_PENALTY : 0;
  const total = Math.max(0, ARRIVAL_POINTS + speed + efficiency + radar);
  return { arrival: ARRIVAL_POINTS, speed, efficiency, radar, nearMiss: 0, total };
}

export function maxScore(rounds: number): number {
  return rounds * ROUND_MAX;
}

export type Rank = { title: string; blurb: string; tone: 'bronze' | 'silver' | 'gold' | 'violet' | 'mint' | 'coral'; min: number };

// Ordered from highest to lowest threshold (share of the maximum score).
const RANKS: Rank[] = [
  { min: 0.9, title: 'Wikipedia Itself', blurb: 'You do not read the encyclopedia. You are the encyclopedia.', tone: 'violet' },
  { min: 0.75, title: 'Six Degrees Legend', blurb: 'Every page is two clicks from anywhere, as far as you can tell.', tone: 'gold' },
  { min: 0.6, title: 'Rabbit-Hole Diver', blurb: 'Fast, focused and suspiciously good at hubs.', tone: 'mint' },
  { min: 0.45, title: 'Link Hopper', blurb: 'You see the shortcuts. Sometimes before the timer does.', tone: 'silver' },
  { min: 0.25, title: 'Page Turner', blurb: 'Solid routes, a few scenic detours.', tone: 'bronze' },
  { min: 0.08, title: 'Casual Browser', blurb: 'You clicked on a lot of things. Some of them were close.', tone: 'coral' },
  { min: 0, title: 'Lost Tourist', blurb: 'The map was upside down. Try again, the hubs will help.', tone: 'coral' },
];

export function rankFor(total: number, max: number): Rank {
  const share = max > 0 ? total / max : 0;
  return RANKS.find(r => share >= r.min) ?? RANKS[RANKS.length - 1];
}

/** 0..1 share of the maximum score, used for bars and rings. */
export function scoreShare(total: number, max: number): number {
  return max > 0 ? Math.min(1, Math.max(0, total / max)) : 0;
}
