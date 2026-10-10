import type { Font } from 'opentype.js';

export interface Fit {
  size: number;
  lines: string[];
}
export interface FitOptions {
  maxW: number;
  maxH: number;
  maxSize: number;
  minSize: number;
  lineHeight: number;
}

/** Keep a little breathing room so the renderer never wraps differently from our measurement. */
const SAFETY = 0.97;

export const measure = (font: Font, text: string, size: number) => font.getAdvanceWidth(text, size);

/** Removes characters the font cannot draw (emoji etc.), so cards never show empty boxes. */
export function drawable(font: Font, text: string): string {
  return Array.from(text)
    .filter((ch) => ch === ' ' || font.charToGlyphIndex(ch) > 0)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitLongWord(font: Font, word: string, size: number, maxW: number): string[] {
  const parts: string[] = [];
  let cur = '';
  for (const ch of Array.from(word)) {
    if (cur && measure(font, cur + ch, size) > maxW) {
      parts.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

function greedy(font: Font, text: string, size: number, maxW: number): string[] {
  const words = text.split(' ').flatMap((w) => (measure(font, w, size) > maxW ? splitLongWord(font, w, size, maxW) : [w]));
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && measure(font, next, size) > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Greedy wrap, then narrow the measure so the lines come out evenly balanced. */
export function wrapBalanced(font: Font, text: string, size: number, maxW: number): string[] {
  const base = greedy(font, text, size, maxW);
  if (base.length < 2) return base;
  // A word wider than the measure gets split by greedy(); never search below what can actually be set.
  let lo = Math.min(maxW, Math.max(...text.split(' ').map((w) => measure(font, w, size))));
  let hi = maxW;
  let best = base;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const attempt = greedy(font, text, size, mid);
    if (attempt.length === base.length) {
      best = attempt;
      hi = mid;
    } else lo = mid;
  }
  return best;
}

export function fitText(font: Font, rawText: string, o: FitOptions): Fit {
  const text = rawText.replace(/\s+/g, ' ').trim();
  const maxW = o.maxW * SAFETY;
  for (let size = o.maxSize; size >= o.minSize; size -= 2) {
    const lines = wrapBalanced(font, text, size, maxW);
    if (lines.length * size * o.lineHeight <= o.maxH) return { size, lines };
  }
  // Still too long at the smallest size: keep what fits and end with an ellipsis.
  const size = o.minSize;
  const maxLines = Math.max(1, Math.floor(o.maxH / (size * o.lineHeight)));
  const lines = wrapBalanced(font, text, size, maxW).slice(0, maxLines);
  const all = wrapBalanced(font, text, size, maxW);
  if (all.length > maxLines) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && measure(font, `${last}\u2026`, size) > maxW) last = last.slice(0, -1).trimEnd();
    lines[lines.length - 1] = `${last}\u2026`;
  }
  return { size, lines };
}

/** Largest size (down to minSize) at which the text fits on one line, or null if it never does. */
export function fitSingleLine(font: Font, text: string, maxW: number, maxSize: number, minSize: number): number | null {
  for (let size = maxSize; size >= minSize; size -= 2) if (measure(font, text, size) <= maxW * SAFETY) return size;
  return null;
}

/** Shrinks a single-line label (pills) until it fits. */
export function fitOneLine(font: Font, text: string, maxW: number, maxSize: number, minSize: number): number {
  for (let size = maxSize; size >= minSize; size -= 1) if (measure(font, text, size) <= maxW * SAFETY) return size;
  return minSize;
}
