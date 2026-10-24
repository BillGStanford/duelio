import { NextRequest } from 'next/server';
import { json, readJson, sameOrigin } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { storeKind } from '@/lib/store';
import { checkGame, type SubmittedGame } from '@/lib/wikirush/points';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Collects points for a signed-in player WITHOUT needing the submit_wikirush_game SQL function.
// It verifies the player's Supabase session, re-computes the score from the raw results, and
// updates wiki_profiles with the service role. The client falls back to this when the RPC is
// missing or rejects a fast run. Backfill: { backfill: <points> } awards points an earlier build
// only kept on the device (once per account, capped).

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const svc = () => process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const sh = (extra: Record<string, string> = {}) => ({ apikey: svc(), authorization: `Bearer ${svc()}`, 'content-type': 'application/json', ...extra });
const BACKFILL_CAP = 20000;

async function userFrom(req: NextRequest): Promise<{ id: string; name: string } | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const res = await fetch(`${url()}/auth/v1/user`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || svc(), authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!res.ok) return null;
  const u = (await res.json()) as { id?: string; user_metadata?: { display_name?: string } };
  return u.id ? { id: u.id, name: String(u.user_metadata?.display_name || 'Trailblazer').slice(0, 24) } : null;
}

type Profile = { user_id: string; points: number; runs_played: number };

async function getProfile(id: string): Promise<Profile | null> {
  const res = await fetch(`${url()}/rest/v1/wiki_profiles?select=user_id,points,runs_played&user_id=eq.${id}`, { headers: sh(), cache: 'no-store' });
  if (!res.ok) throw new Error(`profile ${res.status}`);
  return ((await res.json()) as Profile[])[0] ?? null;
}

/** Adds points with a compare-and-set on the old value, so two games finishing together never lose one. */
async function addPoints(user: { id: string; name: string }, pts: number, runs: number) {
  for (let i = 0; i < 4; i++) {
    const cur = await getProfile(user.id);
    if (!cur) {
      const referral = user.id.replace(/-/g, '').slice(0, 10).toLowerCase();
      const res = await fetch(`${url()}/rest/v1/wiki_profiles`, { method: 'POST', headers: sh({ prefer: 'return=minimal' }), body: JSON.stringify({ user_id: user.id, display_name: user.name, points: pts, runs_played: runs, referral_code: referral }) });
      if (res.ok) return pts;
      continue; // someone created it first: loop and update instead
    }
    const next = Number(cur.points || 0) + pts;
    const res = await fetch(`${url()}/rest/v1/wiki_profiles?user_id=eq.${user.id}&points=eq.${cur.points}`, { method: 'PATCH', headers: sh({ prefer: 'return=representation' }), body: JSON.stringify({ points: next, runs_played: Number(cur.runs_played || 0) + runs }) });
    if (res.ok && ((await res.json()) as unknown[]).length) return next;
  }
  throw new Error('Could not update points');
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: 'Bad origin' }, 403);
  if (storeKind() !== 'supabase') return json({ error: 'Accounts are not configured' }, 501);
  try {
    const user = await userFrom(req);
    if (!user) return json({ error: 'Sign in to save points' }, 401);
    if (!rateLimit(`wr-points:${user.id}`, 20, 60_000)) return json({ error: 'Slow down a little' }, 429);
    const body = (await readJson(req, 12_000)) as SubmittedGame & { backfill?: number };

    if (typeof body.backfill === 'number') {
      const want = Math.min(BACKFILL_CAP, Math.max(0, Math.floor(body.backfill)));
      const cur = await getProfile(user.id);
      const have = Number(cur?.points || 0);
      if (want <= have) return json({ points: have, added: 0 });
      // One-time recovery: marks itself in the table so it cannot be repeated for this account.
      const mark = await fetch(`${url()}/rest/v1/wikirush_guest_claims`, { method: 'POST', headers: sh({ prefer: 'resolution=ignore-duplicates,return=representation' }), body: JSON.stringify({ key: `backfill:${user.id}` }) });
      const marked = mark.ok ? ((await mark.json()) as unknown[]).length : 1; // table missing: allow once, client remembers
      if (!marked) return json({ points: have, added: 0, already: true });
      const total = await addPoints(user, want - have, 0);
      return json({ points: total, added: want - have });
    }

    const checked = checkGame(body, new Date().toISOString().slice(0, 10));
    if (!checked.ok) return json({ error: checked.error }, 400);

    // Best-effort game history + daily-once rule (works when the v2 table exists; otherwise skipped).
    let ranked = true;
    const resultsJson = (body.results || []).map(r => ({ won: !!r.won, elapsed_ms: Math.round(Number(r.elapsed_ms || 0)), clicks: Number(r.clicks || 0), radar: !!r.radar, near: !!r.near }));
    const hist = await fetch(`${url()}/rest/v1/wikirush_games`, { method: 'POST', headers: sh({ prefer: 'return=minimal' }), body: JSON.stringify({ user_id: user.id, mode: checked.mode, seed: checked.seed, rounds: checked.rounds, seconds: checked.seconds, total: checked.total, results: resultsJson }) }).catch(() => null);
    if (hist && hist.status === 409) ranked = false; // unique daily index: second daily is practice

    const pts = ranked ? checked.points : 0;
    const points = pts > 0 ? await addPoints(user, pts, checked.rounds) : Number((await getProfile(user.id))?.points || 0);
    return json({ total: checked.total, points: pts, ranked, balance: points });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Failed' }, 500);
  }
}
