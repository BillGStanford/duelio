import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { rankFor } from '@/lib/wikirush/scoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Score card for challenge links and downloads: /wikirush/og?s=18200&r=5&n=Maya&fmt=story&dl=1
// Uses only built-in fonts, so it never depends on a network fetch at render time.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const rounds = [1, 3, 5].includes(Number(q.get('r'))) ? Number(q.get('r')) : 5;
  const max = rounds * 5000;
  const sRaw = Number(q.get('s'));
  const score = Number.isFinite(sRaw) && q.get('s') !== null ? Math.min(max, Math.max(0, Math.round(sRaw))) : null;
  const name = (q.get('n') || '').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 24);
  const story = q.get('fmt') === 'story';
  const w = story ? 1080 : 1200, h = story ? 1920 : 630;
  const rank = score === null ? null : rankFor(score, max);
  const headline = score === null ? 'Race Wikipedia.' : (name ? `${name} scored` : 'I scored');
  const big = score === null ? 'Beat the clock.' : score.toLocaleString('en-US');
  const res = new ImageResponse(
    <div style={{ width: w, height: h, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: story ? 110 : 70, color: 'white', background: 'linear-gradient(135deg,#0b0f1f 0%,#1c2250 60%,#3b46c4 100%)', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', fontSize: story ? 56 : 38, fontWeight: 800, letterSpacing: 2, color: '#aeb7ff' }}>WIKIRUSH · BY DUELIO</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: story ? 80 : 50, fontWeight: 700, color: 'rgba(255,255,255,.75)' }}>{headline}</div>
        <div style={{ display: 'flex', fontSize: story ? (score === null ? 150 : 250) : (score === null ? 100 : 170), fontWeight: 900, lineHeight: 1.05 }}>{big}</div>
        {rank && <div style={{ display: 'flex', marginTop: 24, alignSelf: 'flex-start', background: '#fcd34d', color: '#101426', fontSize: story ? 60 : 38, fontWeight: 900, padding: '10px 32px', borderRadius: 999 }}>{rank.title}</div>}
      </div>
      <div style={{ display: 'flex', fontSize: story ? 56 : 36, fontWeight: 800 }}>Get from one Wikipedia page to another. Can you beat it?</div>
    </div>,
    { width: w, height: h, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  );
  if (q.get('dl') === '1') res.headers.set('Content-Disposition', 'attachment; filename="wikirush-score.png"');
  return res;
}
