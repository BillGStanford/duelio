import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get('q')?.trim().slice(0, 100) || '';
  if (query.length < 2) return NextResponse.json({ results: [] });
  try {
    const url = new URL('https://en.wikipedia.org/w/rest.php/v1/search/page');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '7');
    const response = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'Duelio/1.0 (https://duelio.ink)' },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 3600 },
    } as RequestInit & { next: { revalidate: number } });
    if (!response.ok) return NextResponse.json({ results: [] });
    const data = await response.json() as { pages?: { title: string; description?: string; thumbnail?: { url?: string } }[] };
    const results = (data.pages || []).map(page => ({
      title: page.title,
      description: page.description || 'Wikipedia article',
      thumbnail: page.thumbnail?.url || null,
    }));
    return NextResponse.json({ results }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
