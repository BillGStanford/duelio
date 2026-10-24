import { createHash } from 'crypto';
import { NextRequest } from 'next/server';
import { clientIp, json, readJson, sameOrigin } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { storeKind } from '@/lib/store';
import { claimKeys, isUsed } from '@/lib/wikirush/guest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { action: 'check' | 'claim', fp, hw }
//  check -> { gate: boolean, used: boolean }   (gate=false means the deployment has no accounts)
//  claim -> records this browser/machine as having used its free game
// Fails open: if the database is unreachable, nobody is locked out of playing.

const base = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/wikirush_guest_claims`;
const auth = () => ({ apikey: process.env.SUPABASE_SERVICE_ROLE_KEY as string, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` });

function hashIp(ip: string) {
  return createHash('sha256').update(`${process.env.SUPABASE_SERVICE_ROLE_KEY}|${ip}`).digest('hex').slice(0, 24);
}

async function existing(keys: string[]): Promise<string[]> {
  const list = keys.map(k => `"${k}"`).join(',');
  const res = await fetch(`${base()}?select=key&key=in.(${encodeURIComponent(list)})`, { headers: auth(), cache: 'no-store' });
  if (!res.ok) throw new Error(`claims ${res.status}`);
  return ((await res.json()) as Array<{ key: string }>).map(r => r.key);
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: 'Bad origin' }, 403);
  if (storeKind() !== 'supabase') return json({ gate: false, used: false });
  const ip = clientIp(req);
  if (!rateLimit(`wr-guest:${ip}`, 30, 60_000)) return json({ gate: true, used: false, throttled: true }, 429);
  try {
    const body = (await readJson(req, 1_000)) as { action?: string; fp?: string; hw?: string };
    const keys = claimKeys({ fp: String(body.fp || ''), hw: String(body.hw || '') }, hashIp(ip));
    if (!keys.length) return json({ gate: true, used: false });
    const used = isUsed(await existing(keys), keys);
    if (body.action === 'claim' && !used) {
      await fetch(base(), {
        method: 'POST',
        headers: { ...auth(), 'content-type': 'application/json', prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify(keys.map(key => ({ key }))),
      });
    }
    return json({ gate: true, used });
  } catch {
    return json({ gate: true, used: false, degraded: true });
  }
}
