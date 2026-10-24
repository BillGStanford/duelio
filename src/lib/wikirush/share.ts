import type { ChallengeParams, GameSettings, GameSummary, RoundResult } from './types';
import { TIME_OPTIONS } from './types';
import { dailyNumber, utcDateKey } from './rounds';
import { rankFor } from './scoring';

export function roundEmoji(r: RoundResult): string {
  if (r.won) return r.score >= 3500 ? '🟩' : '🟨';
  return r.near ? '🟧' : '🟥';
}

export function emojiRow(results: RoundResult[]): string {
  return results.map(roundEmoji).join('');
}

const nf = new Intl.NumberFormat('en-US');
export const formatScore = (n: number) => nf.format(Math.round(n));

export function settingsLabel(s: GameSettings): string {
  const time = TIME_OPTIONS.find(t => t.seconds === s.seconds)?.label ?? `${s.seconds}s`;
  return `${s.rounds} round${s.rounds === 1 ? '' : 's'} · ${time}`;
}

export function buildChallengeUrl(origin: string, params: ChallengeParams): string {
  const url = new URL('/wikirush', origin);
  url.searchParams.set('c', params.seed);
  url.searchParams.set('t', String(params.seconds));
  url.searchParams.set('r', String(params.rounds));
  if (typeof params.score === 'number') url.searchParams.set('s', String(Math.round(params.score)));
  if (params.name) url.searchParams.set('n', params.name.slice(0, 24));
  return url.toString();
}

/** Parses and sanitises `?c=seed&t=90&r=5&s=18200&n=Maya`. Returns null when it is not a challenge link. */
export function parseChallengeParams(search: string): ChallengeParams | null {
  const q = new URLSearchParams(search);
  const seed = (q.get('c') || '').toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(seed)) return null;
  const t = Number(q.get('t'));
  const r = Number(q.get('r'));
  const seconds = [45, 90, 180].includes(t) ? t : 90;
  const rounds = [1, 3, 5].includes(r) ? r : 5;
  const s = Number(q.get('s'));
  const score = Number.isFinite(s) && s >= 0 && s <= rounds * 5000 ? Math.round(s) : undefined;
  const name = (q.get('n') || '').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 24) || undefined;
  return { seed, seconds, rounds, score, name };
}

export type ShareInput = {
  summary: GameSummary;
  origin: string;
  playerName?: string;
  /** Overrides the generated link (featured challenges use their own URL). */
  link?: string;
};

export function buildShareText({ summary, origin, playerName, link: linkOverride }: ShareInput): string {
  const { settings, results, total, max } = summary;
  const rank = rankFor(total, max);
  const wins = results.filter(r => r.won).length;
  let head: string;
  let link: string;
  if (settings.mode === 'daily') {
    const key = (settings.seed || '').replace(/^daily-/, '') || utcDateKey();
    head = `WikiRush Daily #${dailyNumber(key)}`;
    link = `${origin}/wikirush`;
  } else if (settings.seed) {
    head = 'WikiRush';
    link = buildChallengeUrl(origin, { seed: settings.seed, seconds: settings.seconds, rounds: settings.rounds, score: total, name: playerName });
  } else {
    head = 'WikiRush';
    link = `${origin}/wikirush`;
  }
  if (linkOverride) link = linkOverride;
  const lines = [
    `${head} · ${formatScore(total)}/${formatScore(max)}`,
    `${emojiRow(results)} ${rank.title}`,
    `${wins}/${results.length} pages reached · ${settingsLabel(settings)}`,
    settings.seed && settings.mode !== 'daily' ? `Same pages, your turn. Beat me:` : `Can you beat it?`,
    link,
  ];
  return lines.join('\n');
}
