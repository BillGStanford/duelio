// World records: the fastest anyone has found a page, per page pair and overall, plus best games and
// challenge boards. This file holds the pure rules so the server route and the tests share them.
import { scoreRound } from './scoring';
import { normTitle } from './titles';

/** Records need a stricter floor than point scoring: a believable human needs time to read and click. */
export const RECORD_MIN_MS_PER_CLICK = 250;
/** The overall "fastest find" board ignores 1 to 2 click gimmes. */
export const FASTEST_MIN_CLICKS = 3;

export type RecRound = { start: string; target: string; won: boolean; elapsed_ms: number; clicks: number; radar?: boolean; near?: boolean; path?: string[] };
export type RecSubmission = { mode: string; seed?: string | null; featuredId?: string | null; day?: number | null; rounds: number; seconds: number; results: RecRound[] };

export const pairKey = (start: string, target: string) => `${normTitle(start)}>${normTitle(target)}`.slice(0, 400);

export type CleanRound = { start: string; target: string; pair: string; ms: number; clicks: number; radar: boolean; path: string[]; score: number; eligible: boolean };
export type CleanGame = { rounds: CleanRound[]; total: number; allWon: boolean; msTotal: number; clicksTotal: number; mode: string; seed: string | null; featuredId: string | null; day: number | null; seconds: number; count: number };

const clean = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

/** Validates a finished game for the records tables. Returns the cleaned game or an error. */
export function cleanSubmission(raw: RecSubmission): { ok: true; game: CleanGame } | { ok: false; error: string } {
  const rounds = Number(raw.rounds), seconds = Number(raw.seconds);
  if (![1, 3, 5].includes(rounds) || ![45, 90, 180].includes(seconds)) return { ok: false, error: 'Game failed validation' };
  if (!['daily', 'classic', 'wild', 'challenge'].includes(String(raw.mode))) return { ok: false, error: 'Game failed validation' };
  if (!Array.isArray(raw.results) || raw.results.length !== rounds) return { ok: false, error: 'Game failed validation' };
  const limitMs = seconds * 1000;
  const out: CleanRound[] = [];
  let total = 0, msTotal = 0, clicksTotal = 0, allWon = true;
  for (const r of raw.results) {
    const start = clean(r.start, 180), target = clean(r.target, 180);
    if (!start || !target) return { ok: false, error: 'Round failed validation' };
    const won = !!r.won;
    const ms = Math.min(limitMs, Math.max(0, Math.round(Number(r.elapsed_ms ?? limitMs))));
    const clicks = Math.min(60, Math.max(0, Math.round(Number(r.clicks ?? 0))));
    const path = (Array.isArray(r.path) ? r.path : []).slice(0, 62).map(p => clean(p, 180));
    if (won && (clicks < 1 || ms < 120 * clicks)) return { ok: false, error: 'Round failed validation' };
    const score = scoreRound({ won, elapsedMs: ms, limitMs, clicks: Math.max(1, clicks), radar: !!r.radar, near: !!r.near }).total;
    total += score; msTotal += ms; clicksTotal += clicks; if (!won) allWon = false;
    // A record needs a route that actually starts and ends where it says, one click per hop, at a human pace.
    const routeOk = path.length === clicks + 1 && normTitle(path[0] || '') === normTitle(start) && normTitle(path[path.length - 1] || '') === normTitle(target);
    out.push({ start, target, pair: pairKey(start, target), ms, clicks, radar: !!r.radar, path, score, eligible: won && routeOk && ms >= RECORD_MIN_MS_PER_CLICK * clicks });
  }
  const seed = raw.seed ? clean(raw.seed, 40) : null;
  const featuredId = raw.featuredId ? clean(raw.featuredId, 40).replace(/[^a-z0-9-]/gi, '') : null;
  const day = Number(raw.day) >= 1 && Number(raw.day) <= 9999 ? Math.floor(Number(raw.day)) : null;
  return { ok: true, game: { rounds: out, total: Math.min(25000, total), allWon, msTotal, clicksTotal, mode: String(raw.mode), seed, featuredId, day, seconds, count: rounds } };
}

export const fmtMs = (ms: number) => ms < 60000 ? `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s` : `${Math.floor(ms / 60000)}m ${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}s`;

export type RecordRow = {
  id: string; kind: 'round' | 'game'; user_id: string; display_name: string; avatar: number | null;
  pair_key: string | null; start_title: string | null; target_title: string | null; seed: string | null;
  featured_id: string | null; day: number | null; rounds: number | null; seconds: number | null;
  elapsed_ms: number | null; clicks: number | null; total: number | null; all_won: boolean | null; path: string[] | null; created_at: string;
};
