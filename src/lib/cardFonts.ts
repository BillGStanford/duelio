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
const MATCHUP_TEMPLATES: Record<string, string> = {
  story: 'da6a10a0-9a5b-404d-a20f-1556261fa18f.png',
  portrait: '887f247b-5930-40da-bf56-8058d2d86991.png',
  square: 'b10a1fb1-ff9c-41ea-9283-ae7f43adc8a1.png',
  wide: 'bg-duel1.png',
};

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
const matchupTemplateCache = new Map<string, string>();

export async function getMatchupTemplate(fmt: string): Promise<string> {
  const file = MATCHUP_TEMPLATES[fmt] || MATCHUP_TEMPLATES.wide;
  let uri = matchupTemplateCache.get(file);
  if (!uri) {
    const response = await fetch(ASSET_BASE + file, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load matchup card template: ${file}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    uri = `data:image/png;base64,${btoa(binary)}`;
    matchupTemplateCache.set(file, uri);
  }
  return uri;
}

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
