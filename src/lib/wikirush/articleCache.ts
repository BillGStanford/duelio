// Client-side article cache with background prefetching. The point is to make a link click feel
// instant: by the time you click, the next page is usually already in memory.
//
//  - get(title)       resolves from cache, joins an in-flight request, or starts one
//  - peek(title)      synchronous read of an already-loaded article (zero-latency navigation)
//  - prefetchMany()   queues a page's links, a few at a time, in reading order
//  - hint(title)      urgent prefetch for the link under the pointer (jumps the queue)
import { normTitle } from './titles';

export type CachedArticle = { title: string; html: string };
export type Fetcher = (title: string) => Promise<CachedArticle>;

export type ArticleCacheOptions = {
  /** Resolved articles kept in memory (least recently used are dropped first). */
  max?: number;
  /** Background requests allowed at once. Urgent hints are on top of this. */
  concurrency?: number;
};

export function createArticleCache(fetcher: Fetcher, { max = 96, concurrency = 8 }: ArticleCacheOptions = {}) {
  const ready = new Map<string, CachedArticle>(); // insertion order = recency
  const inflight = new Map<string, Promise<CachedArticle>>();
  let queue: string[] = [];
  const titles = new Map<string, string>(); // key -> title as first seen
  let active = 0;

  const key = normTitle;

  function remember(k: string, article: CachedArticle) {
    ready.delete(k);
    ready.set(k, article);
    // A redirect resolves to a different canonical title; serve both names from one entry.
    const canonical = key(article.title);
    if (canonical !== k) { ready.delete(canonical); ready.set(canonical, article); }
    while (ready.size > max) {
      const oldest = ready.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      ready.delete(oldest);
    }
  }

  function load(title: string): Promise<CachedArticle> {
    const k = key(title);
    const hit = ready.get(k);
    if (hit) { ready.delete(k); ready.set(k, hit); return Promise.resolve(hit); }
    const pending = inflight.get(k);
    if (pending) return pending;
    titles.set(k, title);
    const p = fetcher(title).then(
      article => { inflight.delete(k); remember(k, article); return article; },
      error => { inflight.delete(k); throw error; },
    );
    inflight.set(k, p);
    return p;
  }

  function pump() {
    while (active < concurrency && queue.length) {
      const k = queue.shift() as string;
      if (ready.has(k) || inflight.has(k)) continue;
      active++;
      load(titles.get(k) || k).catch(() => {}).finally(() => { active--; pump(); });
    }
  }

  return {
    get: load,
    peek(title: string): CachedArticle | null {
      return ready.get(key(title)) ?? null;
    },
    has(title: string): boolean {
      const k = key(title);
      return ready.has(k) || inflight.has(k);
    },
    /** Queue links in order. A new call replaces what was still waiting from the previous page. */
    prefetchMany(list: string[], limit = 90) {
      queue = [];
      for (const t of list) {
        if (queue.length >= limit) break;
        const k = key(t);
        if (ready.has(k) || inflight.has(k) || queue.includes(k)) continue;
        titles.set(k, t);
        queue.push(k);
      }
      pump();
    },
    /** Start right now, ignoring the concurrency limit: the player is about to click this. */
    hint(title: string) {
      const k = key(title);
      if (ready.has(k) || inflight.has(k)) return;
      queue = queue.filter(q => q !== k);
      load(title).catch(() => {});
    },
    stats() { return { cached: ready.size, inflight: inflight.size, queued: queue.length, active }; },
    clear() { ready.clear(); inflight.clear(); queue = []; titles.clear(); },
  };
}

export type ArticleCache = ReturnType<typeof createArticleCache>;
