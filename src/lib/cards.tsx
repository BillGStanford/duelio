import { ImageResponse } from 'next/og';
import { getBackground, getCardFonts } from './cardFonts';
import { formatCloseDate, SITE_URL } from './site';
import { drawable, fitSingleLine, fitText, measure } from './textFit';

export const FORMATS = ['story', 'portrait', 'square', 'wide'] as const;
export type Fmt = (typeof FORMATS)[number];
export function parseFmt(v: string | null | undefined, fallback: Fmt): Fmt {
  return (FORMATS as readonly string[]).includes(v ?? '') ? (v as Fmt) : fallback;
}

type Tone = 'a' | 'b' | 'n';

const INK = '#14162B';
const MUTE = '#4D5270';
const BLUE = '#2433E0';
const PINK = '#C81E4B';

interface Spec {
  width: number;
  height: number;
  padX: number;
  padY: number;
  brand: number;
  kicker: number;
  foot: number;
  big: number;
  heroMax: number;
  heroH: number;
  bodyMax: number;
  bodyMin: number;
  bodyH: number;
  gap: number;
}

// Four standard sizes: Stories/TikTok/Reels, Instagram feed, square (iMessage, WhatsApp), link card (X, Facebook).
export const SPEC: Record<Fmt, Spec> = {
  story: { width: 1080, height: 1920, padX: 120, padY: 150, brand: 38, kicker: 36, foot: 34, big: 64, heroMax: 230, heroH: 440, bodyMax: 88, bodyMin: 40, bodyH: 800, gap: 46 },
  portrait: { width: 1080, height: 1350, padX: 110, padY: 110, brand: 34, kicker: 32, foot: 30, big: 54, heroMax: 190, heroH: 360, bodyMax: 74, bodyMin: 36, bodyH: 560, gap: 38 },
  square: { width: 1080, height: 1080, padX: 104, padY: 90, brand: 30, kicker: 28, foot: 27, big: 46, heroMax: 150, heroH: 290, bodyMax: 64, bodyMin: 32, bodyH: 390, gap: 30 },
  wide: { width: 1200, height: 630, padX: 110, padY: 58, brand: 26, kicker: 23, foot: 22, big: 36, heroMax: 92, heroH: 180, bodyMax: 52, bodyMin: 26, bodyH: 165, gap: 18 },
};

const host = () => {
  try {
    const h = new URL(SITE_URL).host;
    return h.includes('localhost') ? '' : h;
  } catch {
    return '';
  }
};
const CACHE = 'public, max-age=60, s-maxage=60, stale-while-revalidate=300';

const LOGO = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 28 28"><path d="M14 2a12 12 0 0 0 0 24z" fill="#2433E0"/><path d="M14 2a12 12 0 0 1 0 24z" fill="#C81E4B"/></svg>',
);

interface Parts {
  kicker?: string;
  hero?: { text: string; color: string };
  body: string;
  pills?: { a: string; b: string };
  foot?: string;
  subfoot?: string;
  cta?: string;
  minimal?: boolean;
}

async function compose(fmt: Fmt, tone: Tone, p: Parts, cache: string) {
  const s = SPEC[fmt];
  const { display, ui } = await getCardFonts();
  const bg = await getBackground(tone, fmt);
  const maxW = s.width - 2 * s.padX;

  const line = (text: string, size: number, color: string, family: 'Pagella' | 'Poppins', lh = 1.1, key?: string | number) => (
    <div
      key={key}
      style={{ display: 'flex', justifyContent: 'center', width: '100%', fontFamily: family, fontSize: size, lineHeight: lh, color, whiteSpace: 'nowrap' }}
    >
      {text}
    </div>
  );

  const center: React.ReactNode[] = [];
  if (p.kicker) center.push(line(p.kicker, s.kicker, MUTE, 'Poppins', 1.2, 'kicker'));

  if (p.hero) {
    const t = drawable(display.font, p.hero.text) || p.hero.text;
    // Prefer one big line. Only wrap to two lines when the label is too long to stay large.
    const one = fitSingleLine(display.font, t, maxW, s.heroMax, Math.round(s.heroMax * 0.62));
    const f = one ? { size: one, lines: [t] } : fitText(display.font, t, { maxW, maxH: s.heroH, maxSize: s.heroMax, minSize: 44, lineHeight: 1.04 });
    center.push(
      <div key="hero" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginTop: s.gap * 0.6 }}>
        {f.lines.map((l, i) => line(l, f.size, p.hero!.color, 'Pagella', 1.04, i))}
      </div>,
    );
  }

  const body = drawable(display.font, p.body) || p.body;
  const bf = fitText(display.font, body, { maxW, maxH: s.bodyH, maxSize: s.bodyMax, minSize: s.bodyMin, lineHeight: 1.16 });
  center.push(
    <div key="body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginTop: p.hero || p.kicker ? s.gap : 0 }}>
      {bf.lines.map((l, i) => line(l, bf.size, INK, 'Pagella', 1.16, i))}
    </div>,
  );

  if (p.pills) {
    const a = drawable(ui.font, p.pills.a) || p.pills.a;
    const b = drawable(ui.font, p.pills.b) || p.pills.b;
    const padH = 0.8;
    const vs = s.foot * 1.6;
    // find the largest label size where both pills plus "vs" fit on one row
    let size = Math.round(s.foot * 1.35);
    for (; size > 16; size -= 1) {
      const total = measure(ui.font, a, size) + measure(ui.font, b, size) + 4 * padH * size + vs + 12 + 2 * 6;
      if (total <= maxW * 0.97) break;
    }
    size = Math.max(16, size);
    const pill = (text: string, color: string, key: string) => (
      <div
        key={key}
        style={{
          display: 'flex',
          alignItems: 'center',
          fontFamily: 'Poppins',
          fontSize: size,
          color,
          border: `${Math.max(2, Math.round(size * 0.1))}px solid ${color}`,
          borderRadius: 999,
          padding: `${Math.round(size * 0.3)}px ${Math.round(size * padH)}px`,
          background: 'rgba(255,255,255,0.55)',
        }}
      >
        {text}
      </div>
    );
    center.push(
      <div key="pills" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: s.gap * 1.1 }}>
        {pill(a, BLUE, 'pa')}
        <div style={{ display: 'flex', width: vs, justifyContent: 'center', fontFamily: 'Poppins', fontSize: s.foot, color: MUTE }}>vs</div>
        {pill(b, PINK, 'pb')}
      </div>,
    );
  }

  const foot: React.ReactNode[] = [];
  if (p.foot) foot.push(line(p.foot, s.foot, MUTE, 'Poppins', 1.2, 'foot'));
  if (p.subfoot) foot.push(line(p.subfoot, Math.round(s.foot * 0.82), MUTE, 'Poppins', 1.2, 'subfoot'));
  if (p.cta) foot.push(<div key="cta" style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: p.foot ? s.gap * 0.3 : 0 }}>{line(p.cta, s.big, INK, 'Pagella', 1.1)}</div>);
  const h = host();
  if (h && !p.minimal) foot.push(<div key="host" style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: s.gap * 0.4 }}>{line(h, s.foot * 0.85, MUTE, 'Poppins', 1.2)}</div>);

  const node = (
    <div style={{ width: s.width, height: s.height, display: 'flex', position: 'relative', background: '#EEF0F6' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={bg} width={s.width} height={s.height} alt="" style={{ position: 'absolute', top: 0, left: 0, width: s.width, height: s.height }} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: s.width,
          height: s.height,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: `${s.padY}px ${s.padX}px`,
        }}
      >
        {!p.minimal && (
          <div style={{ display: 'flex', alignItems: 'center', fontFamily: 'Poppins', fontSize: s.brand, color: INK }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/svg+xml;utf8,${LOGO}`} width={s.brand * 1.1} height={s.brand * 1.1} alt="" style={{ marginRight: s.brand * 0.4 }} />
            Duelio
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>{center}</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>{foot}</div>
      </div>
    </div>
  );

  return new ImageResponse(node, {
    width: s.width,
    height: s.height,
    fonts: [
      { name: 'Pagella', data: display.data, weight: 700, style: 'normal' },
      { name: 'Poppins', data: ui.data, weight: 700, style: 'normal' },
    ],
    headers: { 'Cache-Control': cache },
  });
}

export function voteCard(o: {
  fmt: Fmt;
  question: string;
  label: string;
  side: 'a' | 'b';
  pct: number | null;
  total: number;
  closesAt: string | null;
}) {
  const proof =
    o.total > 0 && o.pct !== null ? `${o.pct}% of ${o.total} ${o.total === 1 ? 'vote' : 'votes'} so far` : 'Early votes are coming in';
  return compose(
    o.fmt,
    o.side,
    {
      kicker: 'I picked',
      hero: { text: o.label, color: o.side === 'a' ? BLUE : PINK },
      body: o.question,
      foot: proof,
      subfoot: o.closesAt ? `Voting closes ${formatCloseDate(o.closesAt)}` : undefined,
      cta: 'Do you agree?',
    },
    CACHE,
  );
}

export function roomCard(o: { fmt: Fmt; question: string; labelA: string; labelB: string; count: number }) {
  const status = o.count === 0 ? 'Be the first to vote' : `${o.count} ${o.count === 1 ? 'vote' : 'votes'} in so far`;
  return compose(
    o.fmt,
    'n',
    { kicker: 'Group chat verdict pending', body: o.question, pills: { a: o.labelA, b: o.labelB }, foot: status, cta: 'Tap to vote. No sign up.' },
    CACHE,
  );
}

export function pageCard(o: { fmt: Fmt; question: string; labelA: string; labelB: string }) {
  return compose(
    o.fmt,
    'n',
    { kicker: 'Pick a side', body: o.question, pills: { a: o.labelA, b: o.labelB }, cta: 'Which side are you on?' },
    CACHE,
  );
}

export function resultCard(o: { question: string; labelA: string; labelB: string; pctA: number; pctB: number; total: number }) {
  return compose(
    'wide',
    'n',
    {
      body: o.question,
      pills: {
        a: o.total ? `${o.labelA} ${o.pctA}%` : 'No votes yet',
        b: o.total ? `${o.labelB} ${o.pctB}%` : 'No votes yet',
      },
      minimal: true,
    },
    CACHE,
  );
}

export function takeCard(o: { fmt: Fmt; pct: number; withCrowd: number; considered: number; label: string }) {
  return compose(
    o.fmt,
    'n',
    {
      kicker: 'I side with the crowd',
      hero: { text: `${o.pct}%`, color: o.pct >= 50 ? BLUE : PINK },
      body: `of the time. ${o.label}.`,
      foot: `${o.withCrowd} of ${o.considered} debates`,
      cta: 'How often do you?',
    },
    'private, no-store',
  );
}
