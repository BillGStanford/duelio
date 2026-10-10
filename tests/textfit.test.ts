import { readFileSync } from 'fs';
import path from 'path';
import { parse } from 'opentype.js';
import { describe, expect, it } from 'vitest';
import { SEED_DILEMMAS } from '@/lib/seed';
import { drawable, fitSingleLine, fitText, measure } from '@/lib/textFit';

const buf = readFileSync(path.join(process.cwd(), 'src/assets/Pagella-Bold.otf'));
const font = parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);

// width/height budget of the body text box in each card size
const BOXES = {
  story: { maxW: 840, maxH: 800, maxSize: 88, minSize: 40 },
  portrait: { maxW: 860, maxH: 560, maxSize: 74, minSize: 36 },
  square: { maxW: 872, maxH: 390, maxSize: 64, minSize: 32 },
  wide: { maxW: 980, maxH: 165, maxSize: 52, minSize: 26 },
};
const LH = 1.16;
const check = (text: string, box: (typeof BOXES)['story']) => {
  const f = fitText(font, text, { ...box, lineHeight: LH });
  for (const line of f.lines) expect(measure(font, line, f.size)).toBeLessThanOrEqual(box.maxW);
  expect(f.lines.length * f.size * LH).toBeLessThanOrEqual(box.maxH + 1);
  return f;
};

describe('card text fitting', () => {
  it('fits every seed question in every card size', () => {
    for (const box of Object.values(BOXES)) for (const d of SEED_DILEMMAS) check(d.question, box);
  });
  it('fits the longest allowed question (140 chars)', () => {
    const q = 'Should the person who always drives get to pick the music, the temperature and the route every single time we go out as a group?'.slice(0, 140);
    for (const box of Object.values(BOXES)) check(q, box);
  });
  it('truncates absurdly long text with an ellipsis instead of overflowing', () => {
    const f = check('word '.repeat(200), BOXES.wide);
    expect(f.lines[f.lines.length - 1].endsWith('\u2026')).toBe(true);
  });
  it('breaks a single unbreakable word rather than overflowing', () => {
    check('W'.repeat(60), BOXES.square);
  });
  it('uses larger type for shorter text', () => {
    const short = fitText(font, 'Is pineapple on pizza fine?', { ...BOXES.wide, lineHeight: LH });
    const long = fitText(font, SEED_DILEMMAS[4].question, { ...BOXES.wide, lineHeight: LH });
    expect(short.size).toBeGreaterThan(long.size);
  });
  it('balances lines so the last line is not a lonely word', () => {
    const f = check('Is watching the next episode without your partner betrayal?', BOXES.square);
    const widths = f.lines.map((l) => measure(font, l, f.size));
    expect(Math.min(...widths) / Math.max(...widths)).toBeGreaterThan(0.5);
  });
  it('keeps a headline on one line when it can', () => {
    expect(fitSingleLine(font, 'Split evenly', 872, 150, 90)).not.toBeNull();
    expect(fitSingleLine(font, 'A really quite long side label here', 872, 150, 90)).toBeNull();
  });
  it('drops characters the font cannot draw', () => {
    expect(drawable(font, 'Pizza \u{1F355} night')).toBe('Pizza night');
  });
});
