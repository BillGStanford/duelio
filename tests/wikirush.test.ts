import { describe, expect, it } from 'vitest';
import { randomSeed, seededRng, shuffled } from '@/lib/wikirush/rng';
import { START_POOL, TARGET_POOL } from '@/lib/wikirush/pools';
import { dailyNumber, dailySeed, planRounds } from '@/lib/wikirush/rounds';
import { ROUND_MAX, maxScore, rankFor, scoreRound } from '@/lib/wikirush/scoring';
import { hrefFragment, htmlLinksTo, linkedTitles, normTitle, titleFromHref, titleFromUrl } from '@/lib/wikirush/titles';
import { buildChallengeUrl, buildShareText, emojiRow, parseChallengeParams } from '@/lib/wikirush/share';
import { EMPTY_STATS, applyGame, liveDailyStreak } from '@/lib/wikirush/stats';
import type { GameSummary, RoundResult } from '@/lib/wikirush/types';

function round(over: Partial<RoundResult> = {}): RoundResult {
  return { start: 'Kazoo', target: 'Pizza', won: true, ending: 'arrived', elapsedMs: 30000, limitMs: 90000, clicks: 4, radar: false, near: false, path: ['Kazoo', 'Pizza'], score: 3800, ...over };
}

describe('seeded randomness', () => {
  it('is deterministic per seed and differs between seeds', () => {
    const a = seededRng('abc'); const b = seededRng('abc'); const c = seededRng('abd');
    const seqA = [a(), a(), a()]; const seqB = [b(), b(), b()]; const seqC = [c(), c(), c()];
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    seqA.forEach(n => { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThan(1); });
  });
  it('shuffles without losing items', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffled(input, seededRng('x'));
    expect(out.slice().sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('makes short url-safe seeds', () => {
    expect(randomSeed()).toMatch(/^[a-z0-9]{6}$/);
  });
});

describe('round planning', () => {
  it('returns identical rounds for the same seed', () => {
    expect(planRounds('daily-2026-10-23', 5)).toEqual(planRounds('daily-2026-10-23', 5));
    expect(planRounds('daily-2026-10-23', 5)).not.toEqual(planRounds('daily-2026-10-24', 5));
  });
  it('never repeats pages or pairs a page with itself', () => {
    for (const seed of ['a1', 'b2', 'k7m2qx', 'daily-2026-12-31', 'zzzzzz']) {
      const plans = planRounds(seed, 5);
      expect(plans).toHaveLength(5);
      const all = plans.flatMap(p => [p.start, p.target, ...p.startAlts, ...p.targetAlts].map(normTitle));
      const primaries = plans.flatMap(p => [p.start, p.target].map(normTitle));
      expect(new Set(primaries).size).toBe(10 - primaries.length + new Set(primaries).size);
      plans.forEach(p => expect(normTitle(p.start)).not.toBe(normTitle(p.target)));
      expect(all.length).toBe(5 * 6);
    }
  });
  it('clamps the round count', () => {
    expect(planRounds('x', 0)).toHaveLength(1);
    expect(planRounds('x', 99)).toHaveLength(5);
  });
  it('numbers the dailies from launch day', () => {
    expect(dailyNumber('2026-10-23')).toBe(1);
    expect(dailyNumber('2026-10-24')).toBe(2);
    expect(dailySeed('2026-10-23')).toBe('daily-2026-10-23');
  });
  it('has big enough, duplicate-free pools', () => {
    expect(TARGET_POOL.length).toBeGreaterThanOrEqual(150);
    expect(START_POOL.length).toBeGreaterThanOrEqual(150);
    expect(new Set(TARGET_POOL.map(normTitle)).size).toBe(TARGET_POOL.length);
    expect(new Set(START_POOL.map(normTitle)).size).toBe(START_POOL.length);
  });
});

describe('scoring', () => {
  const base = { won: true, elapsedMs: 0, limitMs: 90000, clicks: 1, radar: false, near: false };
  it('caps a perfect instant win at the round maximum', () => {
    expect(scoreRound(base).total).toBe(ROUND_MAX);
  });
  it('rewards speed and fewer clicks', () => {
    const fast = scoreRound({ ...base, elapsedMs: 20000, clicks: 3 }).total;
    const slow = scoreRound({ ...base, elapsedMs: 70000, clicks: 3 }).total;
    const manyClicks = scoreRound({ ...base, elapsedMs: 20000, clicks: 11 }).total;
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeGreaterThan(manyClicks);
  });
  it('never drops below the arrival bonus minus the radar cost for a win', () => {
    const worst = scoreRound({ ...base, elapsedMs: 90000, clicks: 40, radar: true });
    expect(worst.total).toBe(1400);
    expect(worst.radar).toBe(-600);
  });
  it('gives only a small near-miss credit for a loss', () => {
    expect(scoreRound({ ...base, won: false, near: true }).total).toBe(600);
    expect(scoreRound({ ...base, won: false, near: false }).total).toBe(0);
  });
  it('ignores impossible elapsed times safely', () => {
    expect(scoreRound({ ...base, elapsedMs: 999999 }).speed).toBe(0);
    expect(scoreRound({ ...base, elapsedMs: -5 }).speed).toBe(2000);
  });
  it('maps share of maximum to ranks', () => {
    expect(rankFor(0, maxScore(5)).title).toBe('Lost Tourist');
    expect(rankFor(25000, 25000).title).toBe('Wikipedia Itself');
    expect(rankFor(15000, 25000).title).toBe('Rabbit-Hole Diver');
  });
});

describe('title and link parsing', () => {
  it('reads Parsoid, wiki-path and absolute links', () => {
    expect(titleFromHref('./Eiffel_Tower')).toBe('Eiffel Tower');
    expect(titleFromHref('/wiki/Dungeons_%26_Dragons')).toBe('Dungeons & Dragons');
    expect(titleFromHref('https://en.wikipedia.org/wiki/Pel%C3%A9#Career')).toBe('Pelé');
    expect(titleFromHref('//en.wikipedia.org/wiki/Moon')).toBe('Moon');
  });
  it('keeps titles that merely contain a colon', () => {
    expect(titleFromHref('./Star_Trek:_The_Next_Generation')).toBe('Star Trek: The Next Generation');
  });
  it('rejects other namespaces, red links, anchors and outside sites', () => {
    expect(titleFromHref('./File:Foo.jpg')).toBeNull();
    expect(titleFromHref('./Category:Cats')).toBeNull();
    expect(titleFromHref('./Special:Random')).toBeNull();
    expect(titleFromHref('./Talk:Moon')).toBeNull();
    expect(titleFromHref('./Nope?action=edit&redlink=1')).toBeNull();
    expect(titleFromHref('#cite_note-1')).toBeNull();
    expect(titleFromHref('https://example.com/wiki/Pizza')).toBeNull();
    expect(titleFromHref('')).toBeNull();
    expect(titleFromHref(undefined)).toBeNull();
  });
  it('extracts fragments and canonical titles', () => {
    expect(hrefFragment('./Moon#Formation')).toBe('Formation');
    expect(hrefFragment('./Moon')).toBe('');
    expect(titleFromUrl('https://en.wikipedia.org/w/rest.php/v1/page/Albert_Einstein/html')).toBe('Albert Einstein');
  });
  it('finds links to the target in article html, ignoring case and underscores', () => {
    const html = '<p><a href="./Moon">Moon</a> <a href="./Pizza_(food)">x</a> <a href="./File:Pizza.jpg">img</a> <a href="https://example.com">ext</a></p>';
    expect(linkedTitles(html)).toEqual(['Moon', 'Pizza (food)']);
    expect(htmlLinksTo(html, 'moon')).toBe(true);
    expect(htmlLinksTo(html, 'Pizza')).toBe(false);
    expect(htmlLinksTo(html, 'Pizza (food)')).toBe(true);
  });
});

describe('sharing', () => {
  const settings = { mode: 'classic' as const, rounds: 3, seconds: 90, seed: 'k7m2qx' };
  const results = [round({ score: 4200 }), round({ score: 2600 }), round({ won: false, ending: 'timeout', near: true, score: 600 })];
  const summary: GameSummary = { settings, results, total: 7400, max: 15000, finishedAt: '2026-10-23T05:00:00Z' };

  it('draws an emoji per round', () => {
    expect(emojiRow(results)).toBe('🟩🟨🟧');
    expect(emojiRow([round({ won: false, near: false, score: 0 })])).toBe('🟥');
  });
  it('builds a challenge link that parses back identically', () => {
    const url = buildChallengeUrl('https://duelio.ink', { seed: 'k7m2qx', seconds: 90, rounds: 3, score: 7400, name: 'Maya' });
    const parsed = parseChallengeParams(new URL(url).search);
    expect(parsed).toEqual({ seed: 'k7m2qx', seconds: 90, rounds: 3, score: 7400, name: 'Maya' });
  });
  it('rejects malformed or hostile challenge params', () => {
    expect(parseChallengeParams('?c=<script>')).toBeNull();
    expect(parseChallengeParams('')).toBeNull();
    const p = parseChallengeParams('?c=abc123&t=7&r=9&s=999999&n=%3Cb%3EHax%3C%2Fb%3E');
    expect(p).toMatchObject({ seed: 'abc123', seconds: 90, rounds: 5 });
    expect(p?.score).toBeUndefined();
    expect(p?.name).toBe('bHax/b'.replace('/', ''));
  });
  it('writes a compact shareable result', () => {
    const text = buildShareText({ summary, origin: 'https://duelio.ink', playerName: 'Maya' });
    expect(text).toContain('WikiRush · 7,400/15,000');
    expect(text).toContain('🟩🟨🟧');
    expect(text).toContain('2/3 pages reached');
    expect(text).toContain('https://duelio.ink/wikirush?c=k7m2qx');
  });
  it('labels the daily by number and links to the lobby', () => {
    const text = buildShareText({ summary: { ...summary, settings: { mode: 'daily', rounds: 5, seconds: 90, seed: 'daily-2026-10-24' } }, origin: 'https://duelio.ink' });
    expect(text.startsWith('WikiRush Daily #2')).toBe(true);
    expect(text.endsWith('https://duelio.ink/wikirush')).toBe(true);
  });
});

describe('local stats', () => {
  const game = (mode: 'daily' | 'classic', seed: string, rounds = 5, total = 12000): GameSummary => ({
    settings: { mode, rounds, seconds: 90, seed },
    results: [round({ elapsedMs: 12000, score: 4000 }), round({ won: false, score: 0 })],
    total, max: rounds * 5000, finishedAt: '',
  });
  it('tracks games, wins and the fastest arrival', () => {
    const s = applyGame(EMPTY_STATS, game('classic', 'abc123'));
    expect(s).toMatchObject({ games: 1, rounds: 2, wins: 1, bestScore: 12000, bestRound: 4000, fastestMs: 12000 });
  });
  it('does not let a practice round set the best score', () => {
    expect(applyGame(EMPTY_STATS, game('classic', 'abc123', 1, 4900)).bestScore).toBe(0);
  });
  it('builds and breaks daily streaks', () => {
    let s = applyGame(EMPTY_STATS, game('daily', 'daily-2026-10-23'));
    s = applyGame(s, game('daily', 'daily-2026-10-24'));
    expect(s.dailyStreak).toBe(2);
    expect(liveDailyStreak(s, '2026-10-25')).toBe(2);
    expect(liveDailyStreak(s, '2026-10-27')).toBe(0);
    s = applyGame(s, game('daily', 'daily-2026-10-30'));
    expect(s.dailyStreak).toBe(1);
    expect(s.bestDailyStreak).toBe(2);
  });
  it('does not double count a repeated daily', () => {
    let s = applyGame(EMPTY_STATS, game('daily', 'daily-2026-10-23', 5, 9000));
    s = applyGame(s, game('daily', 'daily-2026-10-23', 5, 11000));
    expect(s.dailyStreak).toBe(1);
    expect(s.daily['2026-10-23']).toBe(11000);
  });
});

import { sanitizeWikipediaHtml } from '@/lib/wikirush/sanitize';

describe('article sanitising', () => {
  const page = `<!DOCTYPE html><html><head><title>x</title><style>.a{}</style><link rel="stylesheet" href="x"></head>
  <body><section><p onclick="evil()">Hi <a href="./Moon" onmouseover="x()">Moon</a>
  <a href="javascript:alert(1)">bad</a><a href='JAVASCRIPT:alert(2)'>bad2</a>
  <img src="//upload.wikimedia.org/a.png" srcset="//upload.wikimedia.org/a2.png 2x" loading="lazy">
  <script>alert(3)</script><iframe src="x"></iframe><form><input></form></p></section></body></html>`;
  const out = sanitizeWikipediaHtml(page);
  it('keeps only the body and drops active content', () => {
    expect(out).not.toMatch(/<script|<style|<link|<iframe|<form|<input|<head|<title/i);
    expect(out).not.toMatch(/onclick|onmouseover/i);
    expect(out).not.toMatch(/javascript:/i);
  });
  it('keeps article links and fixes protocol-relative images', () => {
    expect(out).toContain('href="./Moon"');
    expect(out).toContain('src="https://upload.wikimedia.org/a.png"');
    expect(out).toContain('https://upload.wikimedia.org/a2.png 2x');
    expect(out).not.toContain('loading="lazy"');
  });
});
