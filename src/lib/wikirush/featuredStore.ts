// Server-only storage for detail challenges. Supabase (service role, REST) when configured,
// otherwise a JSON file for local development, same rule as the main store.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { storeKind } from '../store';
import type { Featured, FeaturedInput } from './featured';

type Row = { id: string; day?: number | null; title: string; blurb: string; pairs: Featured['pairs']; seconds: number; active: boolean; created_at: string };
const toFeatured = (r: Row): Featured => ({ id: r.id, day: Number(r.day || 0), title: r.title, blurb: r.blurb || '', pairs: r.pairs, seconds: r.seconds, active: r.active, createdAt: r.created_at });

const rest = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/wikirush_featured`;
const headers = (extra: Record<string, string> = {}) => ({
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY as string, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json', ...extra,
});

function filePath() {
  const dir = process.env.DUELIO_DATA_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), 'duelio') : path.join(process.cwd(), '.data'));
  return path.join(dir, 'wikirush-featured.json');
}
function readFile(): Featured[] {
  try { return JSON.parse(fs.readFileSync(filePath(), 'utf8')) as Featured[]; } catch { return []; }
}
function writeFile(list: Featured[]) {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true });
  fs.writeFileSync(filePath(), JSON.stringify(list, null, 2));
}

export async function listFeatured(opts: { activeOnly?: boolean } = {}): Promise<Featured[]> {
  let list: Featured[];
  if (storeKind() === 'supabase') {
    const res = await fetch(`${rest()}?select=*&order=created_at.desc&limit=50${opts.activeOnly ? '&active=eq.true' : ''}`, { headers: headers(), cache: 'no-store' });
    if (!res.ok) throw new Error(`featured ${res.status}`);
    list = ((await res.json()) as Row[]).map(toFeatured);
  } else {
    list = readFile().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (opts.activeOnly) list = list.filter(f => f.active);
  }
  return list;
}

export async function createFeatured(input: FeaturedInput): Promise<Featured> {
  const day = input.day ?? (await listFeatured().then(l => l.reduce((m, f) => Math.max(m, f.day || 0), 0) + 1).catch(() => 1));
  if (storeKind() === 'supabase') {
    const res = await fetch(rest(), { method: 'POST', headers: headers({ prefer: 'return=representation' }), body: JSON.stringify({ day, title: input.title, blurb: input.blurb, pairs: input.pairs, seconds: input.seconds, active: input.active }) });
    if (!res.ok) throw new Error(`Could not save (${res.status}). Run the wikirush_featured block in supabase/wikirush-v2.sql.`);
    return toFeatured(((await res.json()) as Row[])[0]);
  }
  const item: Featured = { ...input, day, id: randomUUID().replace(/-/g, '').slice(0, 12), createdAt: new Date().toISOString() };
  writeFile([item, ...readFile()]);
  return item;
}

export async function setFeaturedActive(id: string, active: boolean) {
  if (storeKind() === 'supabase') {
    const res = await fetch(`${rest()}?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ active }) });
    if (!res.ok) throw new Error(`Update failed (${res.status})`);
    return;
  }
  writeFile(readFile().map(f => (f.id === id ? { ...f, active } : f)));
}

export async function deleteFeatured(id: string) {
  if (storeKind() === 'supabase') {
    const res = await fetch(`${rest()}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers() });
    if (!res.ok) throw new Error(`Delete failed (${res.status})`);
    return;
  }
  writeFile(readFile().filter(f => f.id !== id));
}
