import { clientIp, json, readJson, sameOrigin } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { createMatchup, listMatchups } from '@/lib/matchups';

export const dynamic = 'force-dynamic';
export async function GET() {
  return json({ matchups: await listMatchups(24) });
}
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Cross-site request blocked.' }, 403);
  if (!rateLimit(`matchup-create:${clientIp(req)}`, 8, 60 * 60_000))
    return json({ error: 'You have created a few matchups. Try again later.' }, 429);
  let body: Record<string, unknown>;
  try { body = await readJson(req) as Record<string, unknown>; }
  catch { return json({ error: 'We could not read those names.' }, 400); }
  const a = typeof body.a === 'string' ? body.a.trim().slice(0, 100) : '';
  const b = typeof body.b === 'string' ? body.b.trim().slice(0, 100) : '';
  if (a.length < 2 || b.length < 2) return json({ error: 'Enter two names, each at least two characters.' }, 422);
  try {
    const matchup = await createMatchup(a, b);
    return json({ ok: true, matchup, url: `/matchup/${matchup.slug}` }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create this matchup.';
    return json({ error: message.slice(0, 180) }, 422);
  }
}
