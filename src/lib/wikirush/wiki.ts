import type { WikiPage } from './types';
import type { RoundPlan } from './rounds';
import { TARGET_POOL } from './pools';
import { normTitle } from './titles';
import { createArticleCache } from './articleCache';

const SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const RANDOM = 'https://en.wikipedia.org/api/rest_v1/page/random/summary';

type SummaryJson = {
  title?: string; extract?: string; description?: string; pageid?: number; type?: string;
  thumbnail?: { source?: string };
};

async function getJson<T>(url: string, tries = 2, timeoutMs = 9000): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
      if (res.ok) return (await res.json()) as T;
      last = new Error(`HTTP ${res.status}`);
      if (res.status === 404) break;
    } catch (e) { last = e; }
    finally { clearTimeout(timer); }
  }
  throw last instanceof Error ? last : new Error('Request failed');
}

function toPage(d: SummaryJson): WikiPage & { disambiguation: boolean } {
  return {
    title: d.title || '',
    extract: d.extract,
    description: d.description,
    thumbnail: d.thumbnail?.source,
    pageid: d.pageid,
    disambiguation: d.type === 'disambiguation',
  };
}

export async function fetchSummary(title: string) {
  const d = await getJson<SummaryJson>(`${SUMMARY}${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`);
  if (!d.title) throw new Error('No such article');
  return toPage(d);
}

export async function fetchRandomSummary() {
  const d = await getJson<SummaryJson>(RANDOM, 2);
  return toPage(d);
}

export type Article = { title: string; html: string };

// Shared by every round so navigation, Back and prefetching all hit one cache.

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Retries on throttling, server errors and network hiccups so a bad moment never ends a round. */
export async function fetchArticle(title: string, opts: { background?: boolean } = {}): Promise<Article> {
  const tries = opts.background ? 2 : 4;
  let last: Error = new Error('Wikipedia is slow right now.');
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`/api/wikirush/article?title=${encodeURIComponent(title)}`, {
        priority: opts.background ? 'low' : 'high',
        headers: opts.background ? { 'x-wr-prefetch': '1' } : undefined,
        signal: AbortSignal.timeout(15000),
      } as RequestInit);
      if (res.status === 404) throw Object.assign(new Error('That article does not exist.'), { fatal: true });
      if (res.ok) {
        const data = (await res.json()) as { title?: string; html?: string };
        if (data.html) return { title: data.title || title, html: data.html };
        last = new Error('Empty article');
      } else if (opts.background && res.status === 429) {
        throw Object.assign(new Error('busy'), { fatal: true });
      } else {
        last = new Error('Wikipedia is slow right now.');
      }
    } catch (e) {
      if ((e as { fatal?: boolean }).fatal) throw e;
      last = new Error('Wikipedia is slow right now.');
    }
    await sleep(300 * (i + 1) ** 2);
  }
  throw last;
}

export const articles = createArticleCache(fetchArticle);

async function firstUsable(titles: string[], avoid: Set<string>): Promise<WikiPage> {
  for (const title of titles) {
    try {
      const page = await fetchSummary(title);
      if (page.disambiguation || avoid.has(normTitle(page.title))) continue;
      return page;
    } catch { /* try the next alternate */ }
  }
  throw new Error('Could not load a playable page.');
}

export type LoadedRound = { start: WikiPage; target: WikiPage; startHtml: string; blurb?: string };

async function withStartHtml(start: WikiPage, target: WikiPage, blurb?: string): Promise<LoadedRound> {
  const art = await articles.get(start.title);
  return { start: { ...start, title: art.title }, target, startHtml: art.html, blurb };
}

/** Resolves a seeded plan into two real, playable pages plus the start page's HTML. */
const roundCache = new Map<string, Promise<LoadedRound>>();

/** Memoized, so the lobby can warm up the likely first round while the player is still deciding. */
export function resolveRound(plan: RoundPlan): Promise<LoadedRound> {
  const key = `${plan.start}|${plan.target}`;
  const hit = roundCache.get(key);
  if (hit) return hit;
  const job = loadRound(plan);
  roundCache.set(key, job);
  job.catch(() => roundCache.delete(key));
  return job;
}

/** Fire-and-forget version of resolveRound for warming. */
export function warmRound(plan: RoundPlan) {
  resolveRound(plan).catch(() => {});
}

async function loadRound(plan: RoundPlan): Promise<LoadedRound> {
  const [start, target] = await Promise.all([
    firstUsable([plan.start, ...plan.startAlts], new Set()),
    firstUsable([plan.target, ...plan.targetAlts], new Set()),
  ]);
  const finalTarget = normTitle(start.title) === normTitle(target.title)
    ? await firstUsable([...plan.targetAlts, plan.target], new Set([normTitle(start.title)]))
    : target;
  return withStartHtml(start, finalTarget, plan.blurb);
}

const LISTY = /^(list|lists|index|outline|timeline|glossary) of\b/i;

/** Wild rounds: a truly random Wikipedia start with a popular, well-linked destination. */
export async function resolveWildRound(usedTargets: Set<string>): Promise<LoadedRound> {
  let start: WikiPage | null = null;
  for (let i = 0; i < 6 && !start; i++) {
    try {
      const p = await fetchRandomSummary();
      if (!p.disambiguation && p.extract && p.extract.length > 80 && !LISTY.test(p.title)) start = p;
    } catch { /* retry */ }
  }
  if (!start) throw new Error('Wikipedia could not find a random page. Try again.');
  const pool = TARGET_POOL.filter(t => !usedTargets.has(normTitle(t)) && normTitle(t) !== normTitle(start!.title));
  const picks: string[] = [];
  for (let i = 0; i < 3; i++) picks.push(pool[Math.floor(Math.random() * pool.length)]);
  const target = await firstUsable(picks, new Set([normTitle(start.title)]));
  return withStartHtml(start, target);
}

export function wikipediaUrl(title: string) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}
