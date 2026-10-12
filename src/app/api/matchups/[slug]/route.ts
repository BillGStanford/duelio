import { randomUUID } from 'crypto';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { hashVoter, VOTER_COOKIE } from '@/lib/auth';
import { clientIp, json, readJson, sameOrigin } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { castMatchupVote, getActiveRound, getClosedWinner, getMatchup, getRoundCounts, getRoundHistory, getVoterSide } from '@/lib/matchups';

export const dynamic = 'force-dynamic';
const VOTER_ID_RE = /^[0-9a-f-]{36}$/;

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const matchup = await getMatchup(params.slug);
  if (!matchup || matchup.status !== 'published') return json({ error: 'Matchup not found.' }, 404);
  try {
    const round = await getActiveRound(matchup.id);
    const [counts, history, champion] = await Promise.all([
      getRoundCounts(round.id), getRoundHistory(matchup.id), getClosedWinner(matchup.id),
    ]);
    const rawId = cookies().get(VOTER_COOKIE)?.value;
    const voterHash = rawId && VOTER_ID_RE.test(rawId) ? hashVoter(rawId) : null;
    const votedSide = voterHash ? await getVoterSide(round.id, voterHash) : null;
    const latestClosed = history.find((r) => r.status === 'closed' && r.closedAt);
    const showWinnerAnimation = !!latestClosed?.closedAt && Date.now() - Date.parse(latestClosed.closedAt) < 30000;
    return json({ matchup, round, counts, history, champion, votedSide, showWinnerAnimation });
  } catch {
    return json({ error: 'Matchup storage is not ready. The administrator must run the matchup SQL migration.' }, 503);
  }
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  if (!sameOrigin(req)) return json({ error: 'Cross-site request blocked.' }, 403);
  if (!rateLimit(`matchup-vote:${clientIp(req)}`, 30, 60_000))
    return json({ error: 'Too many votes in a short period. Please wait a minute.' }, 429);
  let body: Record<string, unknown>;
  try { body = await readJson(req) as Record<string, unknown>; }
  catch { return json({ error: 'We could not read that vote.' }, 400); }
  const side = body.side === 'a' || body.side === 'b' ? body.side : null;
  if (!side || typeof body.roundId !== 'string') return json({ error: 'Choose a side to vote.' }, 422);
  const matchup = await getMatchup(params.slug);
  if (!matchup || matchup.status !== 'published') return json({ error: 'Matchup not found.' }, 404);
  try {
    const round = await getActiveRound(matchup.id);
    if (round.id !== body.roundId) return json({ error: 'That round has ended. The new round is ready.', refresh: true }, 409);
    const raw = cookies().get(VOTER_COOKIE)?.value;
    const isNew = !(raw && VOTER_ID_RE.test(raw));
    const voterId = isNew ? randomUUID() : raw as string;
    const result = await castMatchupVote(round.id, hashVoter(voterId), side);
    if (result.closed) return json({ error: 'That round just ended. Refresh for the next round.', refresh: true }, 409);
    const counts = await getRoundCounts(round.id);
    const out = NextResponse.json({ ok: true, duplicate: result.duplicate, side: result.duplicate ? await getVoterSide(round.id, hashVoter(voterId)) : side, counts, total: counts.a + counts.b });
    if (isNew) {
      const proto = headers().get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '');
      out.cookies.set(VOTER_COOKIE, voterId, { httpOnly: true, sameSite: 'lax', secure: proto === 'https', path: '/', maxAge: 60 * 60 * 24 * 365 });
    }
    return out;
  } catch {
    return json({ error: 'We could not record that vote. Please try again.' }, 503);
  }
}
