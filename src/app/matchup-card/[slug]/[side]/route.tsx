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
  const story = fmt === 'story';
  const neutralShare = new URL(req.url).searchParams.get('share') === '1';
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
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: wide ? "38px 48px" : story ? "68px 64px" : "52px 58px", background: "linear-gradient(135deg, #090f22 0%, #111a33 54%, #231127 100%)", color: "#ffffff", fontFamily: "Arial, sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -170, left: -130, width: 540, height: 540, borderRadius: 270, background: "radial-gradient(circle, rgba(78,92,240,0.42) 0%, rgba(78,92,240,0) 72%)" }} />
      <div style={{ position: "absolute", bottom: -210, right: -100, width: 620, height: 620, borderRadius: 310, background: "radial-gradient(circle, rgba(231,93,135,0.34) 0%, rgba(231,93,135,0) 72%)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: wide ? 20 : 26, fontWeight: 900, letterSpacing: 3, position: "relative" }}><span style={{ color: "#ffffff", letterSpacing: 4 }}>DUELIO.INK</span><span style={{ display: "flex", alignItems: "center", gap: 10, color: "#d8ddf4", fontSize: wide ? 14 : 18, letterSpacing: 2 }}><span style={{ width: 9, height: 9, borderRadius: 5, background: "#73e0bd" }} /> PUBLIC MATCHUP</span></div>
      <div style={{ display: "flex", flexDirection: story ? "column" : "row", alignItems: "stretch", justifyContent: "center", gap: story ? 26 : wide ? 24 : 32, flex: 1, marginTop: 24, marginBottom: 24, position: "relative" }}>
        <div style={{ display: "flex", flexDirection: story ? "row" : "column", alignItems: "center", justifyContent: "center", gap: story ? 26 : 12, flex: 1, minWidth: 0, padding: story ? "22px 24px" : "16px 12px", borderRadius: 26, border: "2px solid rgba(100,124,255,0.8)", background: "linear-gradient(145deg, rgba(47,65,143,0.56), rgba(19,28,55,0.9))" }}>
          <img src={safeImage} width={story ? 260 : wide ? 180 : 270} height={story ? 260 : wide ? 180 : 270} style={{ width: story ? 260 : wide ? 180 : 270, height: story ? 260 : wide ? 180 : 270, objectFit: "cover", borderRadius: 22, border: "4px solid #647cff", background: "#202a4a", flexShrink: 0 }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: story ? "flex-start" : "center", justifyContent: "center", minWidth: 0, flex: 1 }}><div style={{ fontSize: wide ? 12 : 16, fontWeight: 900, letterSpacing: 3, color: "#aebcff", marginBottom: 8 }}>SIDE A · BLUE</div><div style={{ fontSize: wide ? 24 : story ? 38 : 34, fontWeight: 900, textAlign: story ? "left" : "center", lineHeight: 1.08, overflowWrap: "break-word" }}>{(matchup?.nameA || name).slice(0, 64)}</div></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: wide ? 56 : 78, height: wide ? 56 : 78, borderRadius: 50, background: "linear-gradient(135deg, #4e5cf0, #e75d87)", border: "5px solid #10182d", boxShadow: "0 0 0 1px rgba(255,255,255,0.25)", fontSize: wide ? 18 : 24, fontWeight: 900, color: "#ffffff" }}>VS</div></div>
        <div style={{ display: "flex", flexDirection: story ? "row" : "column", alignItems: "center", justifyContent: "center", gap: story ? 26 : 12, flex: 1, minWidth: 0, padding: story ? "22px 24px" : "16px 12px", borderRadius: 26, border: "2px solid rgba(231,93,135,0.85)", background: "linear-gradient(145deg, rgba(126,42,83,0.55), rgba(34,21,45,0.92))" }}>
          <img src={safeOtherImage} width={story ? 260 : wide ? 180 : 270} height={story ? 260 : wide ? 180 : 270} style={{ width: story ? 260 : wide ? 180 : 270, height: story ? 260 : wide ? 180 : 270, objectFit: "cover", borderRadius: 22, border: "4px solid #e75d87", background: "#35223b", flexShrink: 0 }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: story ? "flex-start" : "center", justifyContent: "center", minWidth: 0, flex: 1 }}><div style={{ fontSize: wide ? 12 : 16, fontWeight: 900, letterSpacing: 3, color: "#ffabc7", marginBottom: 8 }}>SIDE B · RED</div><div style={{ fontSize: wide ? 24 : story ? 38 : 34, fontWeight: 900, textAlign: story ? "left" : "center", lineHeight: 1.08, overflowWrap: "break-word" }}>{(matchup?.nameB || other).slice(0, 64)}</div></div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 26, padding: wide ? "20px 24px" : "28px 24px", background: "linear-gradient(100deg, #4e5cf0 0%, #323fc4 50%, #c94474 100%)", border: "1px solid rgba(255,255,255,0.28)", textAlign: "center", position: "relative" }}>
        <div style={{ fontSize: wide ? 14 : 18, fontWeight: 900, letterSpacing: 4, color: "#f2f4ff" }}>{neutralShare ? "THE PEOPLE DECIDE" : "I PICKED MY SIDE"}</div>
        <div style={{ fontSize: wide ? 34 : story ? 58 : 46, fontWeight: 900, marginTop: 8, lineHeight: 1.05 }}>{neutralShare ? "WHO WINS?" : name.slice(0, 54)}</div>
        <div style={{ fontSize: wide ? 16 : 22, fontWeight: 700, marginTop: 10, color: "#ffffff" }}>{neutralShare ? "Choose a side at duelio.ink" : "Your turn. Make your case at duelio.ink."}</div>
      </div>
    </div>,
    { ...dims, headers: { "Cache-Control": "public, max-age=0, s-maxage=60, must-revalidate", "CDN-Cache-Control": "public, max-age=60" } },
  );
}

