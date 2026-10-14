import { ImageResponse } from 'next/og';
import { getMatchup, resolveEntity } from '@/lib/matchups';
import { getCardFonts, getMatchupTemplate } from '@/lib/cardFonts';
import { drawable, fitText } from '@/lib/textFit';

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
  const requestedFmt = paramsUrl.searchParams.get('fmt') || 'wide';
  const fmt = ['story', 'portrait', 'square', 'wide'].includes(requestedFmt) ? requestedFmt : 'wide';
  const dims = fmt === 'story' ? { width: 1080, height: 1920 } : fmt === 'portrait' ? { width: 1080, height: 1350 } : fmt === 'square' ? { width: 1080, height: 1080 } : { width: 1200, height: 630 };
  const neutralShare = paramsUrl.searchParams.get('share') === '1';

  const photo = async (url: string, person: string): Promise<{ src: string; fallback: boolean }> => {
    const initials = person.trim().split(' ').filter(Boolean).slice(0, 2).map(word => Array.from(word)[0] || '').join('').toUpperCase();
    const escaped = initials.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800"><rect width="640" height="800" fill="#e7e7f4"/><text x="320" y="390" text-anchor="middle" font-family="Georgia,serif" font-size="120" fill="#20233a">' + escaped + '</text></svg>';
    const bytes = new TextEncoder().encode(svg);
    let fallbackBinary = '';
    for (let i = 0; i < bytes.length; i += 1) fallbackBinary += String.fromCharCode(bytes[i]);
    const fallback = { src: 'data:image/svg+xml;base64,' + btoa(fallbackBinary), fallback: true };
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
      return { src: 'data:' + type + ';base64,' + btoa(binary), fallback: false };
    } catch { return fallback; }
  };
  // Re-resolve portraits from each displayed name so stale/swapped database image
  // fields cannot put one contender's face under the other contender's name.
  const [entityA, entityB] = matchup
    ? await Promise.all([resolveEntity(matchup.nameA), resolveEntity(matchup.nameB)])
    : [null, null];
  const correctImageA = entityA?.image || image;
  const correctImageB = entityB?.image || otherImage;
  const [safeImageA, safeImageB, template, fonts] = await Promise.all([
    photo(correctImageA, matchup?.nameA || name),
    photo(correctImageB, matchup?.nameB || other),
    getMatchupTemplate(fmt),
    getCardFonts(),
  ]);

  const layout = fmt === 'story'
    ? { photoWidth: 34, photoHeight: 19, photoTops: [14, 55], nameTops: [34, 75], nameWidth: 82, footerMaskTop: 92.1, footerMaskHeight: 3.8, footerNameTop: 92.45, footerNameHeight: 3.2, footerNameWidth: 44, footerSize: 42 }
    : fmt === 'portrait'
      ? { photoWidth: 23, photoHeight: 28, photoTops: [20, 20], nameTops: [50, 50], nameWidth: 42, footerMaskTop: 80.9, footerMaskHeight: 4, footerNameTop: 81.2, footerNameHeight: 3.4, footerNameWidth: 40, footerSize: 35 }
      : fmt === 'square'
        ? { photoWidth: 25, photoHeight: 30, photoTops: [23, 23], nameTops: [55, 55], nameWidth: 42, footerMaskTop: 84.3, footerMaskHeight: 3.9, footerNameTop: 84.6, footerNameHeight: 3.4, footerNameWidth: 36, footerSize: 40 }
        : { photoWidth: 18, photoHeight: 22, photoTops: [21, 21], nameTops: [46, 46], nameWidth: 40, footerMaskTop: 88.5, footerMaskHeight: 5.2, footerNameTop: 89.1, footerNameHeight: 3.4, footerNameWidth: 38, footerSize: 30 };

  const contender = (person: string, photo: { src: string; fallback: boolean }, position: number) => {
    const name = drawable(fonts.display.font, person) || person;
    const initials = person.trim().split(' ').filter(Boolean).slice(0, 2).map(word => Array.from(word)[0] || '').join('').toUpperCase();
    const nameFit = fitText(fonts.display.font, name, {
      maxW: dims.width * layout.nameWidth / 100,
      maxH: dims.height * 0.075,
      maxSize: fmt === 'story' ? 38 : fmt === 'wide' ? 25 : 34,
      minSize: 20,
      lineHeight: 1.05,
    });
    const horizontalLeft = fmt === 'story'
      ? dims.width * (100 - layout.photoWidth) / 200
      : position === 0
        ? dims.width * (50 - layout.photoWidth) / 200
        : dims.width * (50 + (50 - layout.photoWidth) / 2) / 100;
    const photoTop = dims.height * layout.photoTops[position] / 100;
    const photoWidth = dims.width * layout.photoWidth / 100;
    const photoHeight = dims.height * layout.photoHeight / 100;
    return (
      <>
        <img
          src={photo.src}
          width={Math.round(photoWidth)}
          height={Math.round(photoHeight)}
          alt=""
          style={{
            position: 'absolute',
            left: horizontalLeft,
            top: photoTop,
            width: photoWidth,
            height: photoHeight,
            objectFit: 'cover',
            objectPosition: 'center',
            border: '1px solid #c7c9df',
            boxSizing: 'border-box',
          }}
        />
        {photo.fallback && (
          <div
            style={{
              position: 'absolute',
              left: horizontalLeft,
              top: photoTop,
              width: photoWidth,
              height: photoHeight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#20233a',
              fontFamily: 'Pagella',
              fontSize: Math.round(photoWidth * 0.28),
              fontWeight: 700,
            }}
          >
            {initials}
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            left: dims.width * (fmt === 'story' ? 9 : position === 0 ? 5 : 53) / 100,
            top: dims.height * layout.nameTops[position] / 100,
            width: dims.width * layout.nameWidth / 100,
            height: dims.height * (layout.nameWidth === 82 ? 4.3 : 7.5) / 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontFamily: 'Pagella',
            fontSize: nameFit.size,
            lineHeight: 1.05,
            fontWeight: 700,
            color: '#17182a',
          }}
        >
          {nameFit.lines.map((line, i) => <span key={i}>{line}</span>)}
        </div>
      </>
    );
  };

  const selection = neutralShare ? 'Who wins?' : side === 'a' ? matchup?.nameA || name : matchup?.nameB || name;
  const footerText = drawable(fonts.display.font, selection) || selection;
  const footerFit = fitText(fonts.display.font, footerText, {
    maxW: dims.width * layout.footerNameWidth / 100,
    maxH: dims.height * layout.footerNameHeight / 100,
    maxSize: layout.footerSize,
    minSize: 18,
    lineHeight: 1.05,
  });
  const footerLeft = dims.width * (100 - layout.footerNameWidth) / 200;
  const nameLines = footerFit.lines.map((line, i) => <span key={i}>{line}</span>);
  const matchupTitle = `${matchup?.nameA || name} vs. ${matchup?.nameB || other}`;
  const titleFit = fmt === 'wide'
    ? fitText(fonts.display.font, drawable(fonts.display.font, matchupTitle) || matchupTitle, {
      maxW: dims.width * 0.84,
      maxH: dims.height * 0.11,
      maxSize: 34,
      minSize: 20,
      lineHeight: 1.05,
    })
    : null;

  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', background: '#eef0f6', fontFamily: 'Arial, sans-serif' }}>
      <img src={template} width={dims.width} height={dims.height} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {contender(matchup?.nameA || name, safeImageA, 0)}
      {contender(matchup?.nameB || other, safeImageB, 1)}
      {titleFit && (
        <div
          style={{
            position: 'absolute',
            left: dims.width * 0.08,
            top: dims.height * 0.685,
            width: dims.width * 0.84,
            height: dims.height * 0.11,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: '#17182a',
            fontFamily: 'Pagella',
            fontSize: titleFit.size,
            lineHeight: 1.05,
            fontWeight: 700,
          }}
        >
          {titleFit.lines.map((line, i) => <span key={i}>{line}</span>)}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: footerLeft,
          top: dims.height * layout.footerMaskTop / 100,
          width: dims.width * layout.footerNameWidth / 100,
          height: dims.height * layout.footerMaskHeight / 100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          background: 'linear-gradient(180deg, rgba(241,242,250,0) 0%, rgba(241,242,250,0.98) 18%, rgba(241,242,250,0.98) 82%, rgba(241,242,250,0) 100%), linear-gradient(90deg, rgba(241,242,250,0) 0%, rgba(241,242,250,0.98) 14%, rgba(244,243,250,0.98) 50%, rgba(246,241,248,0.98) 86%, rgba(246,241,248,0) 100%)',
          color: '#17182a',
          fontFamily: 'Pagella',
          fontWeight: 700,
          fontSize: footerFit.size,
          lineHeight: 1.05,
        }}
      >
        {nameLines}
      </div>
      {neutralShare && fmt === 'wide' && (
        <div
          style={{
            position: 'absolute',
            left: dims.width * 0.41,
            top: dims.height * 0.85,
            width: dims.width * 0.18,
            height: dims.height * 0.04,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f1f2fa',
            color: '#55576c',
            fontFamily: 'Poppins',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
            THE PEOPLE DECIDE
        </div>
      )}
    </div>,
    { ...dims, fonts: [{ name: 'Pagella', data: fonts.display.data, weight: 700, style: 'normal' }, { name: 'Poppins', data: fonts.ui.data, weight: 700, style: 'normal' }], headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate', 'CDN-Cache-Control': 'public, max-age=60' } },
  );
}
