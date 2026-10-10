import { promises as fs } from 'fs';
import path from 'path';
import { parse, type Font } from 'opentype.js';

export interface LoadedFont {
  data: ArrayBuffer;
  font: Font;
}
export interface CardFonts {
  display: LoadedFont; // Pagella Bold: the headline face
  ui: LoadedFont; // Poppins Bold: small labels
}

const toArrayBuffer = (b: Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

async function load(file: string): Promise<LoadedFont> {
  const data = toArrayBuffer(await fs.readFile(path.join(process.cwd(), 'src/assets', file)));
  return { data, font: parse(data) };
}

let cached: Promise<CardFonts> | null = null;
export function getCardFonts(): Promise<CardFonts> {
  cached ??= Promise.all([load('Pagella-Bold.otf'), load('Poppins-Bold.ttf')]).then(([display, ui]) => ({ display, ui }));
  return cached;
}

const bgCache = new Map<string, string>();
export async function getBackground(tone: 'a' | 'b' | 'n', fmt: string): Promise<string> {
  const key = `${tone}-${fmt}`;
  let uri = bgCache.get(key);
  if (!uri) {
    const buf = await fs.readFile(path.join(process.cwd(), 'src/assets', `bg-${key}.jpg`));
    uri = `data:image/jpeg;base64,${buf.toString('base64')}`;
    bgCache.set(key, uri);
  }
  return uri;
}
