import { ImageResponse } from 'next/og';
import { getMatchup } from '@/lib/matchups';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export async function GET(req: Request, { params }: { params: { slug: string; side: string } }) {
  const matchup = await getMatchup(params.slug);
  const side = params.side === 'b' ? 'b' : 'a';
  const name = matchup ? (side === 'a' ? matchup.nameA : matchup.nameB) : 'Your side';
  const other = matchup ? (side === 'a' ? matchup.nameB : matchup.nameA) : 'The other side';
  const image = matchup ? (side === 'a' ? matchup.imageA : matchup.imageB) : '';
  const otherImage = matchup ? (side === 'a' ? matchup.imageB : matchup.imageA) : '';
  const fmt = new URL(req.url).searchParams.get('fmt') || 'wide';
  const dims = fmt === 'story' ? { width: 1080, height: 1920 } : fmt === 'portrait' ? { width: 1080, height: 1350 } : fmt === 'square' ? { width: 1080, height: 1080 } : { width: 1200, height: 630 };
  const wide = dims.width / dims.height > 1.5;
  const photo = async (url: string, person: string): Promise<string> => {
    const initials = person.trim().split(' ').filter(Boolean).slice(0, 2).map(word => Array.from(word)[0] || '').join('').toUpperCase().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800"><rect width="640" height="800" rx="28" fill="#f0f2ff"/><circle cx="320" cy="300" r="145" fill="white" stroke="#2433E0" stroke-width="5"/><text x="320" y="340" text-anchor="middle" font-family="Arial" font-weight="700" font-size="100" fill="#14162B">' + initials + '</text><text x="320" y="550" text-anchor="middle" font-family="Arial" font-weight="700" font-size="25" fill="#14162B">DUELIO MATCHUP</text></svg>';
    const bytesForFallback = new TextEncoder().encode(svg);
    let fallbackBinary = '';
    for (let i = 0; i < bytesForFallback.length; i += 1) fallbackBinary += String.fromCharCode(bytesForFallback[i]);
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
  const [safeImage, safeOtherImage] = await Promise.all([photo(image, name), photo(otherImage, other)]);
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: wide ? '44px 54px' : '64px 58px', background: 'linear-gradient(135deg,#f7f8ff 0%,#ffffff 52%,#fff0f4 100%)', color: '#14162B', fontFamily: 'Arial, sans-serif', border: '14px solid #2433E0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: wide ? 22 : 28, fontWeight: 800, letterSpacing: 3, color: '#2433E0' }}><span>DUELIO · PUBLIC OPINION</span><span>NO MONEY. JUST OPINIONS.</span></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: wide ? 30 : 38, flex: 1, marginTop: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, height: '100%', minWidth: 0 }}>
          <img src={safeImage} width={wide ? 200 : 340} height={wide ? 200 : 340} style={{ width: wide ? 200 : 340, height: wide ? 200 : 340, objectFit: 'contain', borderRadius: 24, border: '3px solid #2433E0', background: 'white' }} />
          <div style={{ fontSize: wide ? 26 : 42, fontWeight: 900, textAlign: 'center', marginTop: 16 }}>{name.slice(0, 64)}</div>
        </div>
        <div style={{ fontSize: wide ? 28 : 44, fontWeight: 900, color: '#7c8496' }}>VS</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, height: '100%', minWidth: 0 }}>
          <img src={safeOtherImage} width={wide ? 200 : 340} height={wide ? 200 : 340} style={{ width: wide ? 200 : 340, height: wide ? 200 : 340, objectFit: 'contain', borderRadius: 24, border: '3px solid #C81E4B', background: 'white' }} />
          <div style={{ fontSize: wide ? 26 : 42, fontWeight: 900, textAlign: 'center', marginTop: 16 }}>{other.slice(0, 64)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', borderRadius: 24, padding: wide ? '18px 24px' : '26px 24px', background: '#14162B', color: 'white' }}>
        <div style={{ fontSize: wide ? 20 : 30, fontWeight: 800, letterSpacing: 4, color: '#c7ccff' }}>I VOTED FOR</div>
        <div style={{ fontSize: wide ? 38 : 60, fontWeight: 900, textAlign: 'center', marginTop: 6 }}>{name.slice(0, 54)}</div>
        <div style={{ fontSize: wide ? 17 : 24, marginTop: 8, color: '#e1e4f3' }}>Your turn. Pick a side on Duelio.</div>
      </div>
    </div>,
    { ...dims, headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } },
  );
}
