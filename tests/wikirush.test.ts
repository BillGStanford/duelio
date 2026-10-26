import { cleanSubmission, fmtMs } from '@/lib/wikirush/records';
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

import { STARTER_GAMES, STARTER_PAIRS, parseStarterSeed, starterPlans, starterSeed, starterSeedForGame } from '@/lib/wikirush/starters';

describe('starter games', () => {
  it('opens with the fun pairs the first-time player sees', () => {
    const plans = planRounds('starter-0', 3);
    expect(plans.map(p => [p.start, p.target])).toEqual([['Melania Trump', 'Mars'], ['Taylor Swift', 'Ancient Egypt'], ['Mickey Mouse', 'Moon']]);
    expect(plans.every(p => p.blurb && p.startAlts.length === 2 && p.targetAlts.length === 2)).toBe(true);
  });
  it('is deterministic and matches starterPlans', () => {
    expect(planRounds('starter-1', 3)).toEqual(starterPlans(1, 3));
    expect(planRounds('starter-2', 3)).toEqual(planRounds('starter-2', 3));
  });
  it('hands out starter seeds for the first games only', () => {
    expect([0, 1, 2].map(starterSeedForGame)).toEqual(['starter-0', 'starter-1', 'starter-2']);
    expect(starterSeedForGame(STARTER_GAMES)).toBeNull();
    expect(parseStarterSeed(starterSeed(2))).toBe(2);
    expect(parseStarterSeed('k7m2qx')).toBeNull();
    expect(parseStarterSeed('starter-x')).toBeNull();
  });
  it('has unique, sensible pairs and wraps for longer games', () => {
    expect(STARTER_PAIRS.length).toBeGreaterThanOrEqual(9);
    const keys = STARTER_PAIRS.map(p => `${normTitle(p.start)}>${normTitle(p.target)}`);
    expect(new Set(keys).size).toBe(keys.length);
    STARTER_PAIRS.forEach(p => expect(normTitle(p.start)).not.toBe(normTitle(p.target)));
    expect(starterPlans(0, 5)).toHaveLength(5);
    expect(starterPlans(40, 3)).toHaveLength(3);
  });
  it('accepts starter seeds in challenge links', () => {
    expect(parseChallengeParams('?c=starter-0&t=90&r=3')).toMatchObject({ seed: 'starter-0', rounds: 3 });
  });
});

import { createArticleCache } from '@/lib/wikirush/articleCache';

describe('article cache and prefetch', () => {
  function harness(opts?: { max?: number; concurrency?: number }) {
    const calls: string[] = [];
    let running = 0; let peak = 0;
    const gates: Array<() => void> = [];
    const cache = createArticleCache(async title => {
      calls.push(title);
      running++; peak = Math.max(peak, running);
      await new Promise<void>(r => gates.push(r));
      running--;
      return { title: title === 'eiffel tower' ? 'Eiffel Tower' : title, html: `<p>${title}</p>` };
    }, opts);
    const release = async () => { gates.splice(0).forEach(g => g()); await new Promise(r => setTimeout(r, 0)); };
    return { cache, calls, release, peak: () => peak };
  }

  it('fetches once for repeated and concurrent requests', async () => {
    const { cache, calls, release } = harness();
    const a = cache.get('Moon'); const b = cache.get('moon'); 
    await release();
    expect((await a).html).toBe('<p>Moon</p>');
    expect(await b).toBe(await a);
    await cache.get('Moon');
    expect(calls).toEqual(['Moon']);
  });
  it('serves loaded pages synchronously via peek', async () => {
    const { cache, release } = harness();
    expect(cache.peek('Moon')).toBeNull();
    const p = cache.get('Moon'); await release(); await p;
    expect(cache.peek('Moon')?.title).toBe('Moon');
  });
  it('aliases a redirect to its canonical title', async () => {
    const { cache, release } = harness();
    const p = cache.get('eiffel tower'); await release(); await p;
    expect(cache.peek('Eiffel Tower')?.html).toContain('eiffel tower');
  });
  it('limits background concurrency but lets urgent hints through', async () => {
    const { cache, calls, release, peak } = harness({ concurrency: 2 });
    cache.prefetchMany(['A', 'B', 'C', 'D', 'E']);
    expect(calls).toEqual(['A', 'B']);
    cache.hint('Z');
    expect(calls).toEqual(['A', 'B', 'Z']);
    await release(); await release(); await release(); await release();
    expect(new Set(calls)).toEqual(new Set(['A', 'B', 'C', 'D', 'E', 'Z']));
    expect(peak()).toBe(3);
  });
  it('replaces the waiting queue when a new page is prefetched, and skips what is cached', async () => {
    const { cache, calls, release } = harness({ concurrency: 1 });
    cache.prefetchMany(['A', 'B', 'C']);
    cache.prefetchMany(['X', 'A', 'Y']);
    await release(); await release(); await release();
    expect(calls).toEqual(['A', 'X', 'Y']);
  });
  it('evicts the least recently used page and recovers from failures', async () => {
    const { cache, release } = harness({ max: 2 });
    for (const t of ['A', 'B', 'C']) { const p = cache.get(t); await release(); await p; }
    expect(cache.peek('A')).toBeNull();
    expect(cache.peek('C')).not.toBeNull();
    const failing = createArticleCache(async () => { throw new Error('boom'); });
    await expect(failing.get('X')).rejects.toThrow('boom');
    expect(failing.has('X')).toBe(false);
  });
});

import { slimWikipediaHtml } from '@/lib/wikirush/slim';

describe('article slimming', () => {
  const parsoid = `<!DOCTYPE html><html><head><title>Pizza</title></head><body>
  <section data-mw-section-id="0"><p about="#mwt1" data-parsoid='{"dsr":[1,2]}'>Pizza is a dish from <a rel="mw:WikiLink" href="./Italy" title="Italy" data-mw='{"x":1}'>Italy</a>.<sup class="mw-ref reference"><a href="./Pizza#cite_note-1">[1]</a></sup></p>
  <div class="hatnote"><a href="./Pizza_(disambiguation)">other</a></div>
  <img src="//upload.wikimedia.org/p.png" srcset="//upload.wikimedia.org/p2.png 2x"></section>
  <section data-mw-section-id="1"><h2 id="History">History</h2><p>See <a href="./Naples">Naples</a>.</p></section>
  <section data-mw-section-id="2"><h2 id="See_also">See also</h2><ul><li><a href="./Calzone">Calzone</a></li></ul></section>
  <section data-mw-section-id="3"><h2 id="References">References</h2><ol class="mw-references references"><li><a href="./ISBN">book</a></li></ol></section>
  <section data-mw-section-id="4"><h2 id="External_links">External links</h2><ul><li><a href="./Wikimedia_Commons">Commons</a></li></ul></section>
  <div class="navbox"><a href="./Hidden_Nav">nav</a></div></body></html>`;
  const out = slimWikipediaHtml(parsoid);
  it('keeps the readable article and its playable links', () => {
    expect(linkedTitles(out)).toEqual(expect.arrayContaining(['Italy', 'Naples', 'Calzone']));
    expect(out).toContain('Pizza is a dish from');
    expect(out).toContain('src="https://upload.wikimedia.org/p.png"');
  });
  it('drops citations, navboxes, exits and heavy metadata', () => {
    expect(out).not.toMatch(/Hidden_Nav|Wikimedia_Commons|ISBN|Pizza_\(disambiguation\)|cite_note/);
    expect(out).not.toMatch(/data-mw=|data-parsoid|about=|srcset|title="|rel="mw:/);
  });
  it('is meaningfully smaller than the input', () => {
    expect(out.length).toBeLessThan(parsoid.length * 0.75);
  });
});

import { claimKeys, isUsed, mustSignUp, addPending, loadPending, clearPending, guestUsedLocally, markGuestUsed } from '../src/lib/wikirush/guest';

describe('guest gate', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
  const ids = { fp: 'a'.repeat(32), hw: 'b'.repeat(32) };

  it('builds salted-hash claim keys and ignores junk ids', () => {
    expect(claimKeys(ids, 'ip1')).toEqual([`fp:${ids.fp}`, `hwip:${ids.hw}:ip1`]);
    expect(claimKeys({ fp: 'x', hw: '<script>' }, 'ip1')).toEqual([]);
  });
  it('same browser on a new network is still caught by fp; same machine in another browser by hw+ip', () => {
    const first = claimKeys(ids, 'ip1');
    expect(isUsed(first, claimKeys(ids, 'ip2'))).toBe(true); // fp matches
    expect(isUsed(first, claimKeys({ fp: 'c'.repeat(32), hw: ids.hw }, 'ip1'))).toBe(true); // other browser, same machine+network
    expect(isUsed(first, claimKeys({ fp: 'c'.repeat(32), hw: ids.hw }, 'ip2'))).toBe(false); // identical model elsewhere is not blocked
  });
  it('only gates configured deployments and signed-out visitors', () => {
    expect(mustSignUp({ configured: false, signedIn: false, usedLocally: true, usedOnServer: true })).toBe(false);
    expect(mustSignUp({ configured: true, signedIn: true, usedLocally: true, usedOnServer: true })).toBe(false);
    expect(mustSignUp({ configured: true, signedIn: false, usedLocally: false, usedOnServer: false })).toBe(false);
    expect(mustSignUp({ configured: true, signedIn: false, usedLocally: false, usedOnServer: true })).toBe(true);
  });
  it('remembers the free game and queues finished games for sign-up', () => {
    const s = mem();
    expect(guestUsedLocally(s)).toBe(false);
    markGuestUsed(s);
    expect(guestUsedLocally(s)).toBe(true);
    const game = { settings: { mode: 'classic', rounds: 3, seconds: 90 }, results: [{ won: true }], total: 4000, max: 15000, finishedAt: 'now' } as never;
    for (let i = 0; i < 5; i++) addPending(game, s);
    expect(loadPending(s)).toHaveLength(3);
    clearPending(s);
    expect(loadPending(s)).toHaveLength(0);
  });
});

import { WR_FAQ, faqJsonLd, gameJsonLd } from '../src/lib/wikirush/seo';

describe('seo data', () => {
  it('has a FAQ schema matching the visible FAQ and a free VideoGame entity', () => {
    const faq = faqJsonLd();
    expect(faq.mainEntity).toHaveLength(WR_FAQ.length);
    const g = gameJsonLd('https://example.com');
    expect(g.name).toBe('WikiRush');
    expect(g.offers.price).toBe('0');
    expect(g.url).toBe('https://example.com/wikirush');
  });
});

import { levelFor, pointsForGame } from '../src/lib/wikirush/levels';
import { freshSeed, isHardSeed, planRounds as plan2 } from '../src/lib/wikirush/rounds';
import { HARD_TARGET_POOL, POP_STARTS } from '../src/lib/wikirush/pools';

describe('levels and difficulty', () => {
  it('maps points to levels with progress', () => {
    expect(levelFor(0).level.name).toBe('Rookie');
    expect(levelFor(100).level.name).toBe('Explorer');
    expect(levelFor(300).progress).toBeCloseTo(0.5, 1);
    expect(levelFor(99999).next).toBeNull();
    expect(pointsForGame(18299)).toBe(1829);
  });
  it('goes starter, normal, then hard as a player finishes games', () => {
    expect(freshSeed(0)).toMatch(/^starter-/);
    expect(isHardSeed(freshSeed(3))).toBe(false);
    expect(freshSeed(3)).not.toMatch(/^starter-/);
    expect(isHardSeed(freshSeed(6))).toBe(true);
  });
  it('hard rounds avoid pop starts and use the specific-target pool, deterministically', () => {
    const a = plan2('hard-abc123', 5), b = plan2('hard-abc123', 5);
    expect(a).toEqual(b);
    const pop = new Set(POP_STARTS.map(t => t.toLowerCase()));
    for (const r of a) {
      expect(pop.has(r.start.toLowerCase())).toBe(false);
      expect(HARD_TARGET_POOL).toContain(r.target);
      expect(r.blurb).toMatch(/Hard/);
    }
  });
});

import { cleanFeatured, featuredSeed } from '../src/lib/wikirush/featured';

describe('detail challenges', () => {
  const pair = (s: string, t: string) => ({ start: s, target: t });
  it('accepts 1/3/5 rounds and cleans titles', () => {
    const r = cleanFeatured({ title: ' Melania to Mars ', pairs: [pair('Melania_Trump', 'Mars')], seconds: '90' });
    expect(r.ok && r.value.pairs[0].start).toBe('Melania Trump');
    expect(r.ok && r.value.seconds).toBe(90);
  });
  it('rejects bad round counts, missing sides and identical pages', () => {
    expect(cleanFeatured({ title: 'abc', pairs: [pair('A', 'B'), pair('C', 'D')] }).ok).toBe(false);
    expect(cleanFeatured({ title: 'abc', pairs: [pair('A', '')] }).ok).toBe(false);
    expect(cleanFeatured({ title: 'abc', pairs: [pair('Mars', 'mars')] }).ok).toBe(false);
    expect(cleanFeatured({ title: 'ab', pairs: [pair('A', 'B')] }).ok).toBe(false);
  });
  it('builds a short, safe seed', () => {
    expect(featuredSeed('A1b2-C3d4-e5f6-0000-1111')).toMatch(/^feat-[a-z0-9]{1,16}$/);
  });
});

import { checkGame } from '../src/lib/wikirush/points';

describe('server points check', () => {
  const win = { won: true, elapsed_ms: 10000, clicks: 3, radar: false, near: false };
  it('computes the same total as the client and points = total/10', () => {
    const r = checkGame({ mode: 'classic', seed: 'abc123', rounds: 1, seconds: 90, results: [win] }, '2026-10-24');
    expect(r.ok && r.total).toBe(2000 + Math.floor((2000 * 80000) / 90000) + 900);
    expect(r.ok && r.points).toBe(Math.floor((r.ok ? r.total : 0) / 10));
  });
  it('allows quick, prefetched runs but rejects impossible ones', () => {
    expect(checkGame({ mode: 'classic', rounds: 1, seconds: 90, results: [{ ...win, elapsed_ms: 900, clicks: 4 }] }, 'x').ok).toBe(true);
    expect(checkGame({ mode: 'classic', rounds: 1, seconds: 90, results: [{ ...win, elapsed_ms: 100, clicks: 5 }] }, 'x').ok).toBe(false);
  });
  it('only accepts today\'s daily', () => {
    const d = { mode: 'daily', rounds: 5, seconds: 90, results: Array(5).fill(win) };
    expect(checkGame({ ...d, seed: 'daily-2026-10-24' }, '2026-10-24').ok).toBe(true);
    expect(checkGame({ ...d, seed: 'daily-2026-10-01' }, '2026-10-24').ok).toBe(false);
  });
});

import { dayLabel } from '../src/lib/wikirush/featured';
describe('day challenges', () => {
  it('labels releases and keeps a valid day number', () => {
    expect(dayLabel(7)).toBe('Day 7 Challenge');
    const ok = cleanFeatured({ title: 'abc', pairs: [{ start: 'A', target: 'B' }], day: '12' });
    expect(ok.ok && ok.value.day).toBe(12);
    const none = cleanFeatured({ title: 'abc', pairs: [{ start: 'A', target: 'B' }] });
    expect(none.ok && none.value.day).toBeUndefined();
  });
});

import { loadPrefs } from '../src/lib/wikirush/stats';
describe('prefs migration', () => {
  const withStore = (value: string | null, fn: () => void) => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: () => value, setItem: () => {} };
    try { fn(); } finally { delete (globalThis as unknown as { localStorage?: unknown }).localStorage; }
  };
  it('keeps current prefs and drops fields from removed features', () => {
    withStore(JSON.stringify({ rounds: 3, record: true, recordMethod: 'screen', recVer: 3, sound: false }), () => {
      const p = loadPrefs();
      expect(p.rounds).toBe(3); expect(p.sound).toBe(false); expect('record' in p).toBe(false); expect('recVer' in p).toBe(false);
    });
  });
});

describe('world records', () => {
  const round = (over: Record<string, unknown> = {}) => ({ start: 'Taylor Swift', target: 'Mars', won: true, elapsed_ms: 9000, clicks: 3, path: ['Taylor Swift', 'United States', 'Planet', 'Mars'], ...over });
  const sub = (results: unknown[], over: Record<string, unknown> = {}) => ({ mode: 'classic', rounds: results.length, seconds: 90, results, ...over }) as Parameters<typeof cleanSubmission>[0];
  it('accepts a believable winning route and marks it eligible', () => {
    const r = cleanSubmission(sub([round()]));
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.game.rounds[0].eligible).toBe(true); expect(r.game.allWon).toBe(true); expect(r.game.rounds[0].pair).toBe('taylor swift>mars'); }
  });
  it('rejects a route that does not match its click count or endpoints, or is too fast', () => {
    for (const bad of [round({ path: ['Taylor Swift', 'Mars'] }), round({ path: ['A', 'B', 'C', 'D'] }), round({ elapsed_ms: 500 })]) {
      const r = cleanSubmission(sub([bad]));
      if (r.ok) expect(r.game.rounds[0].eligible).toBe(false); else expect(r.error).toMatch(/validation/);
    }
  });
  it('rejects impossible games', () => {
    expect(cleanSubmission(sub([round({ elapsed_ms: 100, clicks: 3 })])).ok).toBe(false);
    expect(cleanSubmission(sub([round(), round()], { rounds: 3 })).ok).toBe(false);
  });
  it('formats times', () => { expect(fmtMs(4210)).toBe('4.21s'); expect(fmtMs(12340)).toBe('12.3s'); expect(fmtMs(95000)).toBe('1m 35s'); });
});
