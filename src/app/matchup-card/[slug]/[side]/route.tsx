import { ImageResponse } from 'next/og';
import { getMatchup, resolveEntity } from '@/lib/matchups';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { slug: string; side: string } }) {
  const matchup = await getMatchup(params.slug);
  const side = params.side === 'b' ? 'b' : 'a';
  const name = matchup ? (side === 'a' ? matchup.nameA : matchup.nameB) : 'Your side';
  const other = matchup ? (side === 'a' ? matchup.nameB : matchup.nameA) : 'The other side';
  const image = matchup ? (side === 'a' ? matchup.imageA : matchup.imageB) : '';
  const otherImage = matchup ? (side === 'a' ? matchup.imageB : matchup.imageA) : '';
  const paramsUrl = new URL(req.url);
  const fmt = paramsUrl.searchParams.get('fmt') || 'wide';
  const dims = fmt === 'story' ? { width: 1080, height: 1920 } : fmt === 'portrait' ? { width: 1080, height: 1350 } : fmt === 'square' ? { width: 1080, height: 1080 } : { width: 1200, height: 630 };
  const wide = fmt === 'wide';
  const story = fmt === 'story';
  const neutralShare = paramsUrl.searchParams.get('share') === '1';

  const photo = async (url: string, person: string): Promise<string> => {
    const initials = person.trim().split(' ').filter(Boolean).slice(0, 2).map(word => Array.from(word)[0] || '').join('').toUpperCase();
    const escaped = initials.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800"><rect width="640" height="800" fill="#e7e7f4"/><text x="320" y="390" text-anchor="middle" font-family="Georgia,serif" font-size="120" fill="#20233a">' + escaped + '</text></svg>';
    const bytes = new TextEncoder().encode(svg);
    let fallbackBinary = '';
    for (let i = 0; i < bytes.length; i += 1) fallbackBinary += String.fromCharCode(bytes[i]);
    const fallback = 'data:image/svg+xml;base64,' + btoa(fallbackBinary);
    if (!url.startsWith('https://')) return fallback;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
      const type = response.headers.get('content-type') || '';
      if (!response.ok || !type.startsWith('image/')) return fallback;
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 4000000) return fallback;
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return 'data:' + type + ';base64,' + btoa(binary);
    } catch { return fallback; }
  };
  // Re-resolve portraits from each displayed name so stale/swapped database image
  // fields cannot put one contender's face under the other contender's name.
  const [entityA, entityB] = matchup
    ? await Promise.all([resolveEntity(matchup.nameA), resolveEntity(matchup.nameB)])
    : [null, null];
  const correctImageA = entityA?.image || image;
  const correctImageB = entityB?.image || otherImage;
  const [safeImageA, safeImageB] = await Promise.all([
    photo(correctImageA, matchup?.nameA || name),
    photo(correctImageB, matchup?.nameB || other),
  ]);
  const pad = story ? '72px 68px' : wide ? '42px 48px' : '56px';
  const photoSize = story ? 300 : wide ? 180 : fmt === 'portrait' ? 250 : 280;
  const nameSize = story ? 44 : wide ? 27 : fmt === 'portrait' ? 36 : 38;

  const contender = (person: string, src: string, label: string, color: string, size: number) => (
    <div style={{ display: 'flex', flexDirection: story ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minWidth: 0, gap: story ? 28 : 16, padding: story ? '26px 18px' : '18px 12px', background: '#ffffff', border: '1px solid #d5d4e6' }}>
      <img src={src} width={size} height={size} style={{ width: size, height: size, objectFit: 'cover', objectPosition: 'center', border: '1px solid #d5d4e6', flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: story ? 'flex-start' : 'center', justifyContent: 'center', minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: wide ? 12 : 16, fontFamily: 'Arial, sans-serif', fontWeight: 700, letterSpacing: 2, color, marginBottom: 10 }}>{label}</div>
        <div style={{ fontSize: nameSize, fontFamily: 'Georgia, Times New Roman, serif', fontWeight: 700, textAlign: story ? 'left' : 'center', lineHeight: 1.08, color: '#17182a', overflowWrap: 'break-word' }}>{person.slice(0, 64)}</div>
      </div>
    </div>
  );

  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad, boxSizing: 'border-box', background: '#efeff9', border: '1px solid #d8d7e8', color: '#17182a', fontFamily: 'Arial, sans-serif', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: wide ? 18 : 22, fontWeight: 800, letterSpacing: 2, borderBottom: '1px solid #d4d3e4', paddingBottom: 18 }}>
        <span>DUELIO.INK</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#55576c', fontSize: wide ? 12 : 15, fontWeight: 700, letterSpacing: 1.5 }}>PUBLIC MATCHUP</span>
      </div>
      <div style={{ display: 'flex', flexDirection: story ? 'column' : 'row', alignItems: 'stretch', justifyContent: 'center', gap: story ? 24 : 18, flex: 1, marginTop: 24, marginBottom: 24 }}>
        {contender(matchup?.nameA || name, safeImageA, 'SIDE A  /  BLUE', '#3548b8', photoSize)}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: story ? '2px 0' : '0 2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: wide ? 48 : 62, height: wide ? 48 : 62, background: '#20233a', color: '#ffffff', fontSize: wide ? 15 : 18, fontWeight: 800, letterSpacing: 1 }}>VS</div>
        </div>
        {contender(matchup?.nameB || other, safeImageB, 'SIDE B  /  RED', '#b33c58', photoSize)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: wide ? '20px 24px' : '28px 24px', background: '#ffffff', borderTop: '3px solid #20233a', textAlign: 'center' }}>
        <div style={{ fontSize: wide ? 12 : 16, fontWeight: 800, letterSpacing: 2, color: '#55576c' }}>{neutralShare ? 'THE PEOPLE DECIDE' : 'I PICKED MY SIDE'}</div>
        <div style={{ fontSize: wide ? 34 : story ? 60 : 48, fontFamily: 'Georgia, Times New Roman, serif', fontWeight: 700, marginTop: 8, lineHeight: 1.05, color: '#17182a' }}>{neutralShare ? 'Who wins?' : name.slice(0, 54)}</div>
        <div style={{ fontSize: wide ? 15 : 20, fontWeight: 500, marginTop: 10, color: '#55576c' }}>{neutralShare ? 'Cast your vote at duelio.ink' : 'Make your case at duelio.ink.'}</div>
      </div>
    </div>,
    { ...dims, headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate', 'CDN-Cache-Control': 'public, max-age=60' } },
  );
}
