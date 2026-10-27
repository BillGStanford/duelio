import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { slimWikipediaHtml } from '@/lib/wikirush/slim';
import { titleFromUrl } from '@/lib/wikirush/titles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_HTML = 2_500_000;
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 400;
const UA = 'Duelio WikiRush/2.0 (https://duelio.ink; Wikipedia article-link game)';

type Entry = { at: number; title: string; html: string };
// Layer 1: in-memory (this instance). Layer 2: Next's persistent data cache (shared across instances).
const memory = new Map<string, Entry>();
const pending = new Map<string, Promise<Entry | null>>();

// Wikipedia throttles clients that open too many connections at once (HTTP 429), which is what made
// the game say "Wikipedia is slow". Background prefetch is capped; a click always gets through.
let backgroundActive = 0;
const BACKGROUND_MAX = 3;

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Two independent Wikipedia endpoints serving the same Parsoid HTML; try each, with retries and backoff. */
async function fetchRaw(title: string): Promise<{ raw: string; url: string } | null> {
  const t = encodeURIComponent(title.replace(/ /g, '_'));
  const endpoints = [
    `https://en.wikipedia.org/w/rest.php/v1/page/${t}/html`,
    `https://en.wikipedia.org/api/rest_v1/page/html/${t}`,
  ];
  let notFound = 0;
  let lastError: unknown = new Error('Wikipedia unavailable');
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          headers: { accept: 'text/html; charset=utf-8', 'accept-encoding': 'gzip', 'user-agent': UA },
          cache: 'no-store',
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) return { raw: await res.text(), url: res.url };
        if (res.status === 404) { notFound++; continue; }
        lastError = new Error(`Wikipedia ${res.status}`);
        const retryAfter = Number(res.headers.get('retry-after'));
        if (res.status === 429 && retryAfter > 0) await wait(Math.min(retryAfter, 2) * 1000);
      } catch (e) { lastError = e; }
    }
    if (notFound >= endpoints.length) return null;
    await wait(250 * (attempt + 1) ** 2);
  }
  throw lastError;
}

async function loadFresh(title: string): Promise<Entry | null> {
  const got = await fetchRaw(title);
  if (!got) return null;
  // The endpoint redirects to the canonical title; reading it back lets the game detect arrivals
  // through redirects (e.g. "Eiffel tower" -> "Eiffel Tower").
  const canonical = titleFromUrl(got.url) || title.replace(/_/g, ' ');
  return { at: Date.now(), title: canonical, html: slimWikipediaHtml(got.raw).slice(0, MAX_HTML) };
}

const loadShared = unstable_cache(
  async (key: string, title: string) => loadFresh(title ?? key),
  ['wikirush-article-v1'],
  { revalidate: 6 * 60 * 60 },
);

async function load(key: string, title: string): Promise<Entry | null> {
  try { return await loadShared(key, title); } catch { return loadFresh(title); }
}

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title')?.trim();
  // eslint-disable-next-line no-control-regex
  if (!title || title.length > 180 || /[\u0000-\u001f]/.test(title)) {
    return NextResponse.json({ error: 'A valid Wikipedia article title is required.' }, { status: 400 });
  }
  const background = request.headers.get('x-wr-prefetch') === '1';
  const key = title.replace(/_/g, ' ').toLowerCase();
  const headers = { 'Cache-Control': 'public, max-age=600, s-maxage=21600, stale-while-revalidate=86400' };
  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json({ title: hit.title, html: hit.html }, { headers });
  if (background && !pending.has(key) && backgroundActive >= BACKGROUND_MAX) {
    return NextResponse.json({ error: 'busy' }, { status: 429, headers: { 'Retry-After': '1' } });
  }
  try {
    let job = pending.get(key);
    if (!job) {
      if (background) backgroundActive++;
      job = load(key, title).finally(() => { pending.delete(key); if (background) backgroundActive--; });
      pending.set(key, job);
    }
    const entry = await job;
    if (!entry) return NextResponse.json({ error: 'Wikipedia could not find that article.' }, { status: 404 });
    memory.set(key, entry);
    if (entry.title.toLowerCase() !== key) memory.set(entry.title.toLowerCase(), entry);
    while (memory.size > MAX_ENTRIES) {
      const oldest = memory.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      memory.delete(oldest);
    }
    return NextResponse.json({ title: entry.title, html: entry.html }, { headers });
  } catch {
    if (hit) return NextResponse.json({ title: hit.title, html: hit.html }, { headers }); // stale beats nothing
    return NextResponse.json({ error: 'Wikipedia is temporarily unavailable.' }, { status: 502 });
  }
}
