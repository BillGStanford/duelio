import { parse, type Font } from 'opentype.js';

export interface LoadedFont {
  data: ArrayBuffer;
  font: Font;
}
export interface CardFonts {
  display: LoadedFont;
  ui: LoadedFont;
}

const ASSET_BASE = 'https://raw.githubusercontent.com/BillGStanford/duelio/main/src/assets/';

async function load(file: string): Promise<LoadedFont> {
  const response = await fetch(ASSET_BASE + file, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Unable to load card font: ${file}`);
  const data = await response.arrayBuffer();
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
    const response = await fetch(ASSET_BASE + `bg-${key}.jpg`, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Unable to load card background: ${key}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    uri = `data:image/jpeg;base64,${btoa(binary)}`;
    bgCache.set(key, uri);
  }
  return uri;
}
