import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 60;

function sanitizeWikipediaHtml(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<(iframe|object|embed|form|input|button)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+srcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"')
    .replace(/<meta\b[^>]*>/gi, '');
}

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title')?.trim();
  if (!title || title.length > 180 || /[\u0000-\u001f]/.test(title)) {
    return NextResponse.json({ error: 'A valid Wikipedia article title is required.' }, { status: 400 });
  }
  const url = `https://en.wikipedia.org/w/rest.php/v1/page/${encodeURIComponent(title.replaceAll(' ', '_'))}/html`;
  try {
    const response = await fetch(url, {
      headers: { accept: 'text/html; charset=utf-8', 'user-agent': 'Duelio WikiRush/1.0 (https://duelio.ink; Wikipedia article-link game)' },
      next: { revalidate: 60 },
    });
    if (!response.ok) return NextResponse.json({ error: 'Wikipedia could not find that article.' }, { status: response.status === 404 ? 404 : 502 });
    const html = sanitizeWikipediaHtml(await response.text());
    return NextResponse.json({ title: title.replaceAll('_', ' '), html }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json({ error: 'Wikipedia is temporarily unavailable.' }, { status: 502 });
  }
}
