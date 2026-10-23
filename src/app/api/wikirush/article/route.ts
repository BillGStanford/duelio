import { NextRequest, NextResponse } from 'next/server';
import { sanitizeWikipediaHtml } from '@/lib/wikirush/sanitize';
import { titleFromUrl } from '@/lib/wikirush/titles';

export const runtime = 'nodejs';
export const revalidate = 300;

const MAX_HTML = 3_500_000;

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title')?.trim();
  // eslint-disable-next-line no-control-regex
  if (!title || title.length > 180 || /[\u0000-\u001f]/.test(title)) {
    return NextResponse.json({ error: 'A valid Wikipedia article title is required.' }, { status: 400 });
  }
  const url = `https://en.wikipedia.org/w/rest.php/v1/page/${encodeURIComponent(title.replace(/ /g, '_'))}/html`;
  try {
    const response = await fetch(url, {
      headers: { accept: 'text/html; charset=utf-8', 'user-agent': 'Duelio WikiRush/2.0 (https://duelio.ink; Wikipedia article-link game)' },
      next: { revalidate: 300 },
    });
    if (!response.ok) return NextResponse.json({ error: 'Wikipedia could not find that article.' }, { status: response.status === 404 ? 404 : 502 });
    const raw = await response.text();
    // The REST endpoint redirects to the canonical title; reading it back lets the game detect
    // arrivals through redirects (e.g. "Eiffel tower" -> "Eiffel Tower").
    const canonical = titleFromUrl(response.url) || title.replace(/_/g, ' ');
    return NextResponse.json({ title: canonical, html: sanitizeWikipediaHtml(raw).slice(0, MAX_HTML) }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
    });
  } catch {
    return NextResponse.json({ error: 'Wikipedia is temporarily unavailable.' }, { status: 502 });
  }
}
