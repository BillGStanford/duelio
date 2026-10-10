import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { hashVoter, VOTER_COOKIE } from '@/lib/auth';
import { clientIp, json, readJson, sameOrigin } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { effectiveCloseAt, previousUtcDate, utcDateKey } from '@/lib/daily';
import { computeResults, isClosed } from '@/lib/results';
import { getStore } from '@/lib/store';
import { parseRoom } from '@/lib/room';
import { isValidSlug, parseSide, validateVoterName } from '@/lib/validate';

export const dynamic = 'force-dynamic';

const VOTER_ID_RE = /^[0-9a-f-]{36}$/;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Cross-site request blocked.' }, 403);
  if (!rateLimit(`vote:${clientIp(req)}`, 30, 60_000))
    return json({ error: 'Too many votes in a row. Wait a minute and try again.' }, 429);

  let body: Record<string, unknown>;
  try {
    body = (await readJson(req)) as Record<string, unknown>;
  } catch {
    return json({ error: 'We couldn\u2019t read that request.' }, 400);
  }
  const side = parseSide(body?.side);
  if (!isValidSlug(body?.slug) || !side) return json({ error: 'That vote isn\u2019t valid.' }, 400);
  const guessedPctA = body?.guessedPctA;
  if (typeof guessedPctA !== 'number' || !Number.isInteger(guessedPctA) || guessedPctA < 0 || guessedPctA > 100)
    return json({ error: 'Guess the crowd split from 0% to 100% before voting.' }, 422);
  const parsedName = validateVoterName(body?.voterName);
  if (!parsedName.ok) return json({ error: parsedName.error }, 422);

  try {
    const store = getStore();
    const dilemma = await store.getDilemmaBySlug(body.slug as string);
    if (!dilemma || dilemma.status !== 'published') return json({ error: 'This dilemma isn\u2019t available.' }, 404);
    const today = utcDateKey();
    await store.getDailyDilemma(previousUtcDate(today));
    await store.getDailyDilemma(today);
    const dailyClose = await store.getLatestDailyClose(dilemma.id);
    const closesAt = effectiveCloseAt(dilemma.closesAt, dailyClose);
    if (isClosed({ closesAt })) return json({ error: 'The vote on this dilemma has closed.' }, 409);

    const existing = cookies().get(VOTER_COOKIE)?.value;
    const isNew = !(existing && VOTER_ID_RE.test(existing));
    const rawId = isNew ? randomUUID() : (existing as string);
    const voterHash = hashVoter(rawId);
    const history = await store.getVoterHistory(voterHash);
    const secondDilemma = history.length === 1 && history[0].dilemmaId !== dilemma.id;

    const res = await store.castVote(
      dilemma.id,
      side,
      voterHash,
      parseRoom(body?.room),
      parsedName.value,
      guessedPctA,
    );
    const counts = (await store.getCounts([dilemma.id]))[dilemma.id];
    const namedVotes = await store.getNamedVotes(dilemma.id);
    const crowdPrediction = await store.getCrowdPrediction(dilemma.id);
    const voteDetail = await store.getVoteDetail(dilemma.id, voterHash);
    const out = NextResponse.json({
      ok: true,
      duplicate: res.duplicate,
      side: res.side,
      results: computeResults(counts),
      namedVotes,
      crowdPrediction,
      guessedPctA: voteDetail?.guessedPctA ?? null,
      secondDilemma: secondDilemma && !res.duplicate,
    });

    if (isNew) {
      const https = req.url.startsWith('https') || req.headers.get('x-forwarded-proto') === 'https';
      out.cookies.set(VOTER_COOKIE, rawId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: https,
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return out;
  } catch {
    return json({ error: 'We couldn\u2019t record that vote. Try again.' }, 500);
  }
}
