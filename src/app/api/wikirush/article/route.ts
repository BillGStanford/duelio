import { NextRequest, NextResponse } from 'next/server';
import { slimWikipediaHtml } from '@/lib/wikirush/slim';
import { titleFromUrl } from '@/lib/wikirush/titles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_HTML = 2_500_000;
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 400;

type Entry = { at: number; title: string; html: string };
// Hot pages (countries, big cities, years) are requested over and over by different players.
// Keep the slimmed result in memory so only the first request pays for Wikipedia + parsing.
const memory = new Map<string, Entry>();
const pending = new Map<string, Promise<Entry | null>>();

async function load(title: string): Promise<Entry | null> {
  const url = `https://en.wikipedia.org/w/rest.php/v1/page/${encodeURIComponent(title.replace(/ /g, '_'))}/html`;
  const response = await fetch(url, {
    headers: { accept: 'text/html; charset=utf-8', 'accept-encoding': 'gzip', 'user-agent': 'Duelio WikiRush/2.0 (https://duelio.ink; Wikipedia article-link game)' },
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Wikipedia ${response.status}`);
  const raw = await response.text();
  // The endpoint redirects to the canonical title; reading it back lets the game detect arrivals
  // through redirects (e.g. "Eiffel tower" -> "Eiffel Tower").
  const canonical = titleFromUrl(response.url) || title.replace(/_/g, ' ');
  return { at: Date.now(), title: canonical, html: slimWikipediaHtml(raw).slice(0, MAX_HTML) };
}

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title')?.trim();
  // eslint-disable-next-line no-control-regex
  if (!title || title.length > 180 || /[\u0000-\u001f]/.test(title)) {
    return NextResponse.json({ error: 'A valid Wikipedia article title is required.' }, { status: 400 });
  }
  const key = title.replace(/_/g, ' ').toLowerCase();
  const headers = { 'Cache-Control': 'public, max-age=600, s-maxage=21600, stale-while-revalidate=86400' };
  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json({ title: hit.title, html: hit.html }, { headers });
  try {
    let job = pending.get(key);
    if (!job) {
      job = load(title).finally(() => pending.delete(key));
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
