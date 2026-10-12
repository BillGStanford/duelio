import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get('name')?.trim().slice(0, 100) || 'Duelio';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => Array.from(word)[0]?.toLocaleUpperCase()).join('') || 'D';
  const escaped = initials.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#edf0ff"/><stop offset="1" stop-color="#fbeaf0"/></linearGradient></defs><rect width="640" height="800" rx="32" fill="url(#g)"/><circle cx="320" cy="310" r="148" fill="#fff" stroke="#6170f0" stroke-width="5"/><text x="320" y="355" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="112" fill="#28304a">${escaped}</text><text x="320" y="570" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="28" fill="#28304a">DUELIO MATCHUP</text></svg>`;
  return new NextResponse(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } });
}
