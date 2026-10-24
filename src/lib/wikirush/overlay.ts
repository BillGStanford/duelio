// Canvas renderer for the branded recording. Used two ways:
//  - "screen": the captured tab is drawn as the base layer and our brand chrome goes on top.
//  - "reel":   no capture permission needed; we draw a vertical, share-ready scene from game
//              state (works on phones, where screen capture does not exist).
import type { GameSummary, RoundResult } from './types';
import { rankFor } from './scoring';
import { emojiRow, formatScore } from './share';

export type OverlayPhase = 'idle' | 'intro' | 'countdown' | 'playing' | 'roundEnd' | 'final';

export type OverlayState = {
  phase: OverlayPhase;
  modeLabel: string;
  roundIdx: number;
  rounds: number;
  startTitle: string;
  targetTitle: string;
  targetDesc?: string;
  currentTitle: string;
  msLeft: number;
  limitMs: number;
  clicks: number;
  path: string[];
  totalScore: number;
  countdown?: number;
  lastResult?: RoundResult | null;
  summary?: GameSummary | null;
};

export type OverlayAssets = {
  mark: HTMLImageElement | null;
  bgLandscape: HTMLImageElement | null;
  bgVertical: HTMLImageElement | null;
  targetThumb: HTMLImageElement | null;
};

export const INTRO_MS = 2200;
export const OUTRO_MS = 3200;

const FONT = '"Avenir Next","Helvetica Neue",Helvetica,Arial,system-ui,sans-serif';
const C = { ink: '#101426', indigo: '#6978f5', soft: '#aeb7ff', pink: '#e75d87', mint: '#4ade80', amber: '#fbbf24', red: '#f87171' };

type Ctx = CanvasRenderingContext2D;

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function fit(ctx: Ctx, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function font(ctx: Ctx, weight: number, px: number) {
  ctx.font = `${weight} ${Math.round(px)}px ${FONT}`;
}

function cover(ctx: Ctx, img: CanvasImageSource, iw: number, ih: number, w: number, h: number) {
  const k = Math.max(w / iw, h / ih);
  const dw = iw * k; const dh = ih * k;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function background(ctx: Ctx, w: number, h: number, assets: OverlayAssets) {
  const img = h > w ? assets.bgVertical : assets.bgLandscape;
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, w, h);
  if (img) cover(ctx, img, img.naturalWidth, img.naturalHeight, w, h);
}

function brandPill(ctx: Ctx, s: number, assets: OverlayAssets, x: number, y: number) {
  const hgt = 46 * s;
  font(ctx, 800, 20 * s);
  const label = 'DUELIO · WIKIRUSH';
  const tw = ctx.measureText(label).width;
  const w = hgt + tw + 22 * s;
  ctx.fillStyle = 'rgba(16,20,38,.78)';
  rr(ctx, x, y, w, hgt, hgt / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(174,183,255,.35)'; ctx.lineWidth = 1.5 * s; ctx.stroke();
  if (assets.mark) ctx.drawImage(assets.mark, x + 7 * s, y + 7 * s, hgt - 14 * s, hgt - 14 * s);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + hgt + 2 * s, y + hgt / 2 + 1 * s);
}

/** Wraps text into at most `maxLines` lines. */
function wrap(ctx: Ctx, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxW || !line) line = test;
    else { lines.push(line); line = word; }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) lines[maxLines - 1] = fit(ctx, `${lines[maxLines - 1]} …`, maxW);
  return lines;
}

/** Screen mode: the captured tab sits in a branded frame so our chrome never covers the game UI. */
const FRAME_TOP = 64;
const FRAME_BOTTOM = 60;

function screenChrome(ctx: Ctx, w: number, h: number, s: number, st: OverlayState, assets: OverlayAssets, video: HTMLVideoElement | null) {
  const top = FRAME_TOP * s; const bottom = FRAME_BOTTOM * s;
  // stage with the live capture
  const sx = 14 * s; const sw = w - sx * 2; const sy = top; const sh = h - top - bottom;
  if (video && video.videoWidth) {
    const k = Math.min(sw / video.videoWidth, sh / video.videoHeight);
    const dw = video.videoWidth * k; const dh = video.videoHeight * k;
    const dx = sx + (sw - dw) / 2; const dy = sy + (sh - dh) / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 24 * s;
    ctx.fillStyle = '#000'; rr(ctx, dx, dy, dw, dh, 10 * s); ctx.fill();
    ctx.restore();
    ctx.save(); rr(ctx, dx, dy, dw, dh, 10 * s); ctx.clip();
    ctx.drawImage(video, dx, dy, dw, dh);
    ctx.restore();
    ctx.strokeStyle = 'rgba(174,183,255,.35)'; ctx.lineWidth = 1.5 * s; rr(ctx, dx, dy, dw, dh, 10 * s); ctx.stroke();
  }
  // top bar
  brandPill(ctx, s, assets, 18 * s, (top - 46 * s) / 2);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
  font(ctx, 800, 18 * s); ctx.fillStyle = C.soft;
  const live = st.phase === 'idle' || !st.rounds ? '' : `ROUND ${Math.min(st.roundIdx + 1, st.rounds)}/${st.rounds}   ·   ${formatScore(st.totalScore)} PTS`;
  ctx.fillText(live, w - 22 * s, top / 2 + 1 * s);
  // bottom bar
  const y = h - bottom / 2;
  font(ctx, 800, 20 * s); ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
  const route = st.phase === 'idle' || !st.startTitle ? 'Race from one Wikipedia page to another' : `${st.startTitle}  →  ${st.targetTitle}`;
  ctx.fillText(fit(ctx, route, w * 0.6), 24 * s, y);
  ctx.textAlign = 'right'; ctx.fillStyle = C.soft;
  ctx.fillText('Play free · duelio.ink/wikirush', w - 24 * s, y);
}

function ring(ctx: Ctx, cx: number, cy: number, r: number, frac: number, color: string, s: number) {
  ctx.lineWidth = 12 * s; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, Math.min(1, frac))); ctx.stroke();
}

/** Reel mode: a full vertical scene built from game state. */
function reelScene(ctx: Ctx, w: number, h: number, s: number, st: OverlayState, assets: OverlayAssets) {
  const pad = 44 * s;
  brandPill(ctx, s, assets, pad, 54 * s);
  ctx.textBaseline = 'middle';

  // Header: round + score
  font(ctx, 800, 26 * s); ctx.fillStyle = C.soft; ctx.textAlign = 'right';
  ctx.fillText(`ROUND ${Math.min(st.roundIdx + 1, st.rounds)} / ${st.rounds}`, w - pad, 78 * s);
  font(ctx, 700, 22 * s); ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.fillText(`${formatScore(st.totalScore)} pts`, w - pad, 112 * s);

  // Timer ring
  const frac = st.limitMs > 0 ? st.msLeft / st.limitMs : 0;
  const low = st.msLeft <= 10000 && st.phase === 'playing';
  const cy = 330 * s;
  ring(ctx, w / 2, cy, 112 * s, st.phase === 'playing' ? frac : 1, low ? C.red : C.indigo, s);
  ctx.textAlign = 'center';
  if (st.phase === 'countdown') {
    font(ctx, 900, 120 * s); ctx.fillStyle = '#fff';
    ctx.fillText(String(st.countdown ?? ''), w / 2, cy + 4 * s);
  } else {
    font(ctx, 900, 74 * s); ctx.fillStyle = low ? C.red : '#fff';
    ctx.fillText(clock(st.phase === 'intro' ? st.limitMs : st.msLeft), w / 2, cy + 2 * s);
    font(ctx, 700, 20 * s); ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillText(st.phase === 'roundEnd' ? 'ROUND OVER' : 'TIME LEFT', w / 2, cy + 56 * s);
  }

  // FROM / TO cards
  const cardW = w - pad * 2;
  const cardH = 128 * s;
  const y1 = 500 * s;
  const card = (y: number, label: string, title: string, accent: string, thumb?: HTMLImageElement | null) => {
    ctx.fillStyle = 'rgba(255,255,255,.07)'; rr(ctx, pad, y, cardW, cardH, 26 * s); ctx.fill();
    ctx.strokeStyle = accent; ctx.lineWidth = 2.5 * s; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
    let tx = pad + 26 * s;
    if (thumb) {
      ctx.save(); rr(ctx, pad + 18 * s, y + 18 * s, cardH - 36 * s, cardH - 36 * s, 16 * s); ctx.clip();
      const side = cardH - 36 * s; const k = Math.max(side / thumb.naturalWidth, side / thumb.naturalHeight);
      const dw = thumb.naturalWidth * k; const dh = thumb.naturalHeight * k;
      ctx.drawImage(thumb, pad + 18 * s + (side - dw) / 2, y + 18 * s + (side - dh) / 2, dw, dh);
      ctx.restore(); tx = pad + cardH;
    }
    ctx.textAlign = 'left';
    font(ctx, 800, 18 * s); ctx.fillStyle = accent; ctx.fillText(label, tx, y + 38 * s);
    font(ctx, 800, 36 * s); ctx.fillStyle = '#fff';
    ctx.fillText(fit(ctx, title, cardW - (tx - pad) - 26 * s), tx, y + 82 * s);
  };
  card(y1, 'START', st.startTitle || '…', C.soft);
  ctx.textAlign = 'center'; font(ctx, 800, 30 * s); ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.fillText('↓', w / 2, y1 + cardH + 26 * s);
  card(y1 + cardH + 52 * s, 'DESTINATION', st.targetTitle || '…', C.pink, assets.targetThumb);

  // Now reading
  const yr = y1 + cardH * 2 + 120 * s;
  ctx.textAlign = 'center';
  font(ctx, 800, 20 * s); ctx.fillStyle = C.soft; ctx.fillText('NOW READING', w / 2, yr);
  font(ctx, 900, 52 * s); ctx.fillStyle = '#fff';
  const lines = wrap(ctx, st.currentTitle || st.startTitle || '…', cardW, 2);
  lines.forEach((l, i) => ctx.fillText(l, w / 2, yr + 58 * s + i * 58 * s));

  // Trail chips (last 4)
  const chipsY = yr + 58 * s + lines.length * 58 * s + 34 * s;
  const trail = st.path.slice(-5);
  font(ctx, 700, 22 * s);
  trail.forEach((p, i) => {
    const y = chipsY + i * 46 * s;
    const last = i === trail.length - 1;
    ctx.fillStyle = last ? 'rgba(105,120,245,.35)' : 'rgba(255,255,255,.07)';
    const label = fit(ctx, `${last ? '●' : '○'}  ${p}`, cardW - 40 * s);
    const tw = ctx.measureText(label).width + 36 * s;
    rr(ctx, w / 2 - tw / 2, y, tw, 38 * s, 19 * s); ctx.fill();
    ctx.fillStyle = last ? '#fff' : 'rgba(255,255,255,.7)'; ctx.fillText(label, w / 2, y + 20 * s);
  });

  // Clicks + footer
  font(ctx, 800, 22 * s); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.textAlign = 'center';
  ctx.fillText(`${st.clicks} click${st.clicks === 1 ? '' : 's'}`, w / 2, h - 150 * s);
  font(ctx, 800, 26 * s); ctx.fillStyle = C.soft;
  ctx.fillText('Play free · duelio.ink/wikirush', w / 2, h - 96 * s);

  // Round result stamp
  if (st.phase === 'roundEnd' && st.lastResult) {
    const r = st.lastResult;
    ctx.fillStyle = 'rgba(10,13,26,.72)'; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    font(ctx, 900, 120 * s); ctx.fillStyle = r.won ? C.mint : r.near ? C.amber : C.red;
    ctx.fillText(r.won ? 'ARRIVED' : r.ending === 'gave-up' ? 'GAVE UP' : "TIME'S UP", w / 2, h * 0.4);
    font(ctx, 900, 150 * s); ctx.fillStyle = '#fff';
    ctx.fillText(`+${formatScore(r.score)}`, w / 2, h * 0.52);
    font(ctx, 700, 30 * s); ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fillText(`${r.start} → ${r.target}`, w / 2, h * 0.6, w - pad * 2);
  }
}

function introCard(ctx: Ctx, w: number, h: number, s: number, assets: OverlayAssets, t: number) {
  const fade = t > INTRO_MS - 500 ? Math.max(0, (INTRO_MS - t) / 500) : 1;
  ctx.save();
  ctx.globalAlpha = fade;
  background(ctx, w, h, assets);
  ctx.fillStyle = 'rgba(10,13,26,.55)'; ctx.fillRect(0, 0, w, h);
  const pop = Math.min(1, t / 380); const ease = 1 - Math.pow(1 - pop, 3);
  ctx.translate(w / 2, h / 2); ctx.scale(0.92 + 0.08 * ease, 0.92 + 0.08 * ease);
  if (assets.mark) ctx.drawImage(assets.mark, -70 * s, -190 * s, 140 * s, 140 * s);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  font(ctx, 900, 112 * s); ctx.fillStyle = '#fff'; ctx.fillText('WikiRush', 0, 10 * s);
  font(ctx, 700, 30 * s); ctx.fillStyle = C.soft; ctx.fillText('Race from one Wikipedia page to another', 0, 92 * s, w * 0.9);
  font(ctx, 800, 22 * s); ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.fillText('A game by Duelio · duelio.ink/wikirush', 0, 140 * s, w * 0.9);
  ctx.restore();
}

function outroCard(ctx: Ctx, w: number, h: number, s: number, assets: OverlayAssets, t: number, summary: GameSummary | null | undefined) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, t / 450);
  background(ctx, w, h, assets);
  ctx.fillStyle = 'rgba(10,13,26,.6)'; ctx.fillRect(0, 0, w, h);
  const vertical = h > w;
  const cx = w / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const top = vertical ? h * 0.1 : h * 0.09;
  if (assets.mark) ctx.drawImage(assets.mark, cx - 34 * s, top - 34 * s, 68 * s, 68 * s);
  font(ctx, 800, 22 * s); ctx.fillStyle = C.soft; ctx.fillText('DUELIO · WIKIRUSH', cx, top + 62 * s);
  if (summary) {
    const rank = rankFor(summary.total, summary.max);
    const count = Math.min(1, Math.max(0, (t - 200) / 1100));
    const shown = Math.round(summary.total * (1 - Math.pow(1 - count, 3)));
    font(ctx, 800, 26 * s); ctx.fillStyle = 'rgba(255,255,255,.65)';
    ctx.fillText('FINAL SCORE', cx, top + (vertical ? 150 : 120) * s);
    font(ctx, 900, (vertical ? 150 : 128) * s); ctx.fillStyle = '#fff';
    ctx.fillText(formatScore(shown), cx, top + (vertical ? 250 : 210) * s);
    font(ctx, 700, 28 * s); ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText(`out of ${formatScore(summary.max)}`, cx, top + (vertical ? 332 : 280) * s);
    font(ctx, 900, 52 * s); ctx.fillStyle = C.amber;
    ctx.fillText(rank.title, cx, top + (vertical ? 410 : 340) * s, w * 0.9);
    font(ctx, 700, 44 * s); ctx.fillStyle = '#fff';
    ctx.fillText(emojiRow(summary.results), cx, top + (vertical ? 484 : 400) * s);
    // round rows
    font(ctx, 700, 24 * s);
    const rowsTop = top + (vertical ? 560 : 462) * s;
    const rowW = Math.min(w - 80 * s, 760 * s);
    summary.results.slice(0, 5).forEach((r, i) => {
      const y = rowsTop + i * 48 * s;
      ctx.fillStyle = 'rgba(255,255,255,.08)'; rr(ctx, cx - rowW / 2, y - 20 * s, rowW, 40 * s, 14 * s); ctx.fill();
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
      ctx.fillText(fit(ctx, `${r.won ? '✓' : '✗'}  ${r.start} → ${r.target}`, rowW - 150 * s), cx - rowW / 2 + 18 * s, y + 1 * s);
      ctx.textAlign = 'right'; ctx.fillStyle = r.won ? C.mint : 'rgba(255,255,255,.55)';
      ctx.fillText(formatScore(r.score), cx + rowW / 2 - 18 * s, y + 1 * s);
    });
    ctx.textAlign = 'center';
  }
  const pillW = Math.min(w - 80 * s, 520 * s);
  const py = h - (vertical ? 120 : 62) * s;
  ctx.fillStyle = C.indigo; rr(ctx, cx - pillW / 2, py - 32 * s, pillW, 64 * s, 32 * s); ctx.fill();
  font(ctx, 900, 28 * s); ctx.fillStyle = '#fff'; ctx.fillText('Beat it → duelio.ink/wikirush', cx, py + 1 * s, pillW - 30 * s);
  ctx.restore();
}

export type FrameOptions = {
  method: 'screen' | 'reel';
  source: HTMLVideoElement | null;
  state: OverlayState;
  assets: OverlayAssets;
  /** ms since the recording began */
  t: number;
  /** ms since the outro began, or null */
  outroT: number | null;
};

export function drawFrame(ctx: Ctx, w: number, h: number, o: FrameOptions) {
  const s = (h > w ? w : h) / 720;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  if (o.method === 'screen') {
    background(ctx, w, h, o.assets);
    ctx.fillStyle = 'rgba(10,13,26,.55)'; ctx.fillRect(0, 0, w, h);
    screenChrome(ctx, w, h, s, o.state, o.assets, o.source);
  } else {
    background(ctx, w, h, o.assets);
    ctx.fillStyle = 'rgba(10,13,26,.35)'; ctx.fillRect(0, 0, w, h);
    reelScene(ctx, w, h, s, o.state, o.assets);
  }
  if (o.t < INTRO_MS) introCard(ctx, w, h, s, o.assets, o.t);
  if (o.outroT !== null) outroCard(ctx, w, h, s, o.assets, o.outroT, o.state.summary);
  ctx.restore();
}
