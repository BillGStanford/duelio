import { NextRequest } from 'next/server';
import { json, readJson, sameOrigin } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { storeKind } from '@/lib/store';
import { FASTEST_MIN_CLICKS, cleanSubmission, type RecSubmission } from '@/lib/wikirush/records';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Records a finished game on the world-record tables. Needs a signed-in player. Everything is
// re-validated here; the browser only sends the raw round results. Failure never affects points.

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const svc = () => process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const sh = (extra: Record<string, string> = {}) => ({ apikey: svc(), authorization: `Bearer ${svc()}`, 'content-type': 'application/json', ...extra });
const T = () => `${url()}/rest/v1/wikirush_records`;

async function userFrom(req: NextRequest): Promise<{ id: string; name: string; avatar: number | null } | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const res = await fetch(`${url()}/auth/v1/user`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || svc(), authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!res.ok) return null;
  const u = (await res.json()) as { id?: string; user_metadata?: { display_name?: string; avatar?: number } };
  if (!u.id) return null;
  const av = Number(u.user_metadata?.avatar);
  return { id: u.id, name: String(u.user_metadata?.display_name || 'Explorer').slice(0, 24), avatar: av >= 1 && av <= 12 ? av : null };
}

async function get<R>(query: string): Promise<R[]> {
  const res = await fetch(`${T()}?${query}`, { headers: sh(), cache: 'no-store' });
  if (!res.ok) throw new Error(`records ${res.status}`);
  return (await res.json()) as R[];
}
async function count(query: string): Promise<number> {
  const res = await fetch(`${T()}?select=id&${query}`, { headers: sh({ prefer: 'count=exact', range: '0-0' }), cache: 'no-store' });
  const range = res.headers.get('content-range') || '';
  const n = Number(range.split('/')[1]);
  return Number.isFinite(n) ? n : 0;
}
const enc = encodeURIComponent;

type Out = { start: string; target: string; ms: number; clicks: number; rank: number; record: boolean; personalBest: boolean; holder?: { name: string; ms: number } };

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: 'Bad origin' }, 403);
  if (storeKind() !== 'supabase') return json({ error: 'Accounts are not configured' }, 501);
  try {
    const user = await userFrom(req);
    if (!user) return json({ error: 'Sign in to set records' }, 401);
    if (!rateLimit(`wr-records:${user.id}`, 20, 60_000)) return json({ error: 'Slow down a little' }, 429);
    const checked = cleanSubmission((await readJson(req, 16_000)) as RecSubmission);
    if (!checked.ok) return json({ error: checked.error }, 400);
    const g = checked.game;
    const base = { user_id: user.id, display_name: user.name, avatar: user.avatar };
    const rounds: Out[] = [];

    for (const r of g.rounds) {
      if (!r.eligible) continue;
      const pairQ = `kind=eq.round&pair_key=eq.${enc(r.pair)}`;
      const [best] = await get<{ elapsed_ms: number; display_name: string; user_id: string }>(`select=elapsed_ms,display_name,user_id&${pairQ}&order=elapsed_ms.asc&limit=1`);
      const [mine] = await get<{ id: string; elapsed_ms: number }>(`select=id,elapsed_ms&${pairQ}&user_id=eq.${user.id}&limit=1`);
      const personalBest = !mine || r.ms < mine.elapsed_ms;
      const row = { ...base, kind: 'round', pair_key: r.pair, start_title: r.start, target_title: r.target, seed: g.seed, featured_id: g.featuredId, day: g.day, rounds: g.count, seconds: g.seconds, elapsed_ms: r.ms, clicks: r.clicks, total: r.score, all_won: true, path: r.path, created_at: new Date().toISOString() };
      if (!mine) await fetch(T(), { method: 'POST', headers: sh({ prefer: 'return=minimal' }), body: JSON.stringify(row) });
      else if (personalBest) await fetch(`${T()}?id=eq.${mine.id}`, { method: 'PATCH', headers: sh({ prefer: 'return=minimal' }), body: JSON.stringify(row) });
      const faster = await count(`${pairQ}&elapsed_ms=lt.${r.ms}&user_id=neq.${user.id}`);
      const record = personalBest && (!best || r.ms < best.elapsed_ms);
      rounds.push({ start: r.start, target: r.target, ms: r.ms, clicks: r.clicks, rank: faster + 1, record, personalBest, ...(best && best.user_id !== user.id ? { holder: { name: best.display_name, ms: best.elapsed_ms } } : {}) });
    }

    // Overall fastest find (3+ clicks), looked up for the fastest eligible round of this game.
    const fast = g.rounds.filter(r => r.eligible && r.clicks >= FASTEST_MIN_CLICKS).sort((a, b) => a.ms - b.ms)[0];
    const fastest = fast ? { ms: fast.ms, rank: (await count(`kind=eq.round&clicks=gte.${FASTEST_MIN_CLICKS}&elapsed_ms=lt.${fast.ms}&user_id=neq.${user.id}`)) + 1 } : null;

    // Game row: challenge/daily boards keep one best per player; other games only when strong.
    let game: { total: number; rank: number | null; featured?: boolean } | null = null;
    const boardKey = g.featuredId || (g.seed && g.seed.startsWith('daily-') ? g.seed : null);
    const worthIt = g.count >= 3 && (g.allWon || g.total >= g.count * 2500);
    if (boardKey || worthIt) {
      const gameRow = { ...base, kind: 'game', seed: boardKey && g.featuredId ? `feat-${g.featuredId}`.slice(0, 40) : g.seed, featured_id: g.featuredId, day: g.day, rounds: g.count, seconds: g.seconds, elapsed_ms: g.allWon ? g.msTotal : null, clicks: g.clicksTotal, total: g.total, all_won: g.allWon, created_at: new Date().toISOString() };
      if (boardKey) {
        const q = `kind=eq.game&user_id=eq.${user.id}&${g.featuredId ? `featured_id=eq.${enc(g.featuredId)}` : `seed=eq.${enc(g.seed || '')}`}`;
        const [mine] = await get<{ id: string; total: number }>(`select=id,total&${q}&limit=1`);
        if (!mine) await fetch(T(), { method: 'POST', headers: sh({ prefer: 'return=minimal' }), body: JSON.stringify(gameRow) });
        else if (g.total > mine.total) await fetch(`${T()}?id=eq.${mine.id}`, { method: 'PATCH', headers: sh({ prefer: 'return=minimal' }), body: JSON.stringify(gameRow) });
        const filter = g.featuredId ? `featured_id=eq.${enc(g.featuredId)}` : `seed=eq.${enc(g.seed || '')}`;
        game = { total: g.total, rank: (await count(`kind=eq.game&${filter}&total=gt.${Math.max(g.total, mine?.total ?? 0)}&user_id=neq.${user.id}`)) + 1, featured: !!g.featuredId };
      } else {
        await fetch(T(), { method: 'POST', headers: sh({ prefer: 'return=minimal' }), body: JSON.stringify(gameRow) });
        game = { total: g.total, rank: (await count(`kind=eq.game&rounds=eq.${g.count}&total=gt.${g.total}`)) + 1 };
      }
    }
    return json({ rounds, fastest, game });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Failed' }, 500);
  }
}
