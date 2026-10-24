// Server-side game validation and point maths for /api/wikirush/points. It mirrors the SQL function
// submit_wikirush_game so points are collected the same way even before that migration is run.
import { scoreRound } from './scoring';
import { pointsForGame } from './levels';

export type SubmittedRound = { won?: boolean; elapsed_ms?: number; clicks?: number; radar?: boolean; near?: boolean };
export type SubmittedGame = { mode?: string; seed?: string | null; rounds?: number; seconds?: number; results?: SubmittedRound[] };

export type Checked = { ok: true; total: number; points: number; rounds: number; seconds: number; mode: string; seed: string | null } | { ok: false; error: string };

/** Shortest believable time per click. Prefetched pages open instantly, so this is deliberately low. */
export const MIN_MS_PER_CLICK = 120;

export function checkGame(g: SubmittedGame, todayKey: string): Checked {
  const mode = String(g.mode || '');
  const rounds = Number(g.rounds);
  const seconds = Number(g.seconds);
  const seed = g.seed ? String(g.seed).slice(0, 40) : null;
  if (!['daily', 'classic', 'wild', 'challenge'].includes(mode) || ![1, 3, 5].includes(rounds) || ![45, 90, 180].includes(seconds)) return { ok: false, error: 'Game failed validation' };
  if (mode === 'daily' && (rounds !== 5 || seconds !== 90 || seed !== `daily-${todayKey}`)) return { ok: false, error: 'Daily game failed validation' };
  if (!Array.isArray(g.results) || g.results.length !== rounds) return { ok: false, error: 'Game failed validation' };
  const limitMs = seconds * 1000;
  let total = 0;
  for (const r of g.results) {
    const won = !!r.won;
    const elapsedMs = Math.min(limitMs, Math.max(0, Math.round(Number(r.elapsed_ms ?? limitMs))));
    const clicks = Math.min(60, Math.max(0, Math.round(Number(r.clicks ?? 0))));
    if (won && (clicks < 1 || elapsedMs < MIN_MS_PER_CLICK * clicks)) return { ok: false, error: 'Round failed validation' };
    total += scoreRound({ won, elapsedMs, limitMs, clicks: Math.max(1, clicks), radar: !!r.radar, near: !!r.near }).total;
  }
  total = Math.min(25000, total);
  return { ok: true, total, points: pointsForGame(total), rounds, seconds, mode, seed };
}
