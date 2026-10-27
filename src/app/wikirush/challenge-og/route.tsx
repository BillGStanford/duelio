import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { listFeatured } from '@/lib/wikirush/featuredStore';
import { teaserFor } from '@/lib/wikirush/featured';
import { imageDataUrl, previewPair } from '@/lib/wikirush/thumbs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Share image for a Day N Challenge: the first round's two pages with their photos and a teaser.
// /wikirush/challenge-og?f=<challenge id>   (1200x630, built-in fonts only)
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function Card({ title, label, src, color }: { title: string; label: string; src: string | null; color: string }) {
  return <div style={{ display: 'flex', flexDirection: 'column', width: 420, borderRadius: 32, overflow: 'hidden', background: '#141a36', border: `4px solid ${color}` }}>
    <div style={{ display: 'flex', width: 420, height: 270, background: 'linear-gradient(135deg,#2b3370,#141a36)', alignItems: 'center', justifyContent: 'center' }}>
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="" width={420} height={270} style={{ width: 420, height: 270, objectFit: 'cover' }} />
        : <div style={{ display: 'flex', fontSize: 130, fontWeight: 900, color: 'rgba(255,255,255,.35)' }}>{title.slice(0, 1).toUpperCase()}</div>}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 24px 22px' }}>
      <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, letterSpacing: 3, color }}>{label}</div>
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, color: 'white', marginTop: 4 }}>{clip(title, 22)}</div>
    </div>
  </div>;
}

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get('f') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
  const list = id ? await listFeatured({}).catch(() => []) : [];
  const f = list.find(x => x.id === id);
  const pair = f?.pairs[0] ?? { start: 'Taylor Swift', target: 'Mars' };
  const pv = await previewPair(pair.start, pair.target);
  const [a, b] = await Promise.all([imageDataUrl(pv.start.image), imageDataUrl(pv.target.image)]);
  const teaser = f ? teaserFor(f) : 'Can you get from one page to another using only links?';
  const label = f?.day ? `DAY ${f.day} CHALLENGE` : 'WIKIRUSH CHALLENGE';
  return new ImageResponse(
    <div style={{ width: 1200, height: 630, display: 'flex', flexDirection: 'column', padding: '40px 54px', color: 'white', background: 'linear-gradient(135deg,#0b0f1f 0%,#1c2250 60%,#3b46c4 100%)', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', background: '#fcd34d', color: '#101426', fontSize: 30, fontWeight: 900, padding: '8px 26px', borderRadius: 999, letterSpacing: 2 }}>{label}</div>
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 800, color: '#aeb7ff', letterSpacing: 2 }}>WIKIRUSH · DUELIO</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 26 }}>
        <Card title={pv.start.title || pair.start} label="START" src={a} color="#aeb7ff" />
        <svg width="90" height="90" viewBox="0 0 24 24"><path d="M4 12h14M12 5l7 7-7 7" fill="none" stroke="#fcd34d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <Card title={pv.target.title || pair.target} label="FIND THIS" src={b} color="#fb7185" />
      </div>
      <div style={{ display: 'flex', marginTop: 'auto', fontSize: 34, fontWeight: 700, color: 'rgba(255,255,255,.88)' }}>{clip(teaser, 70)}</div>
    </div>,
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=600, s-maxage=3600' } },
  );
}
