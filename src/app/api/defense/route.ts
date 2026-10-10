import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { hashVoter, VOTER_COOKIE } from '@/lib/auth';
import { clientIp, json, readJson, sameOrigin } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { effectiveCloseAt } from '@/lib/daily';
import { isClosed } from '@/lib/results';
import { getStore } from '@/lib/store';
import { isValidSlug, parseSide, validateDefense } from '@/lib/validate';

export const dynamic = 'force-dynamic';

const VOTER_ID_RE = /^[0-9a-f-]{36}$/;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Cross-site request blocked.' }, 403);
  if (!rateLimit(`defense:${clientIp(req)}`, 20, 60_000))
    return json({ error: 'Too many requests. Wait a minute and try again.' }, 429);

  let body: Record<string, unknown>;
  try {
    body = (await readJson(req)) as Record<string, unknown>;
  } catch {
    return json({ error: 'We couldn\u2019t read that request.' }, 400);
  }

  if (!isValidSlug(body.slug)) return json({ error: 'That dilemma is not valid.' }, 400);
  const cookieId = cookies().get(VOTER_COOKIE)?.value;
  if (!cookieId || !VOTER_ID_RE.test(cookieId)) return json({ error: 'Vote on this dilemma first.' }, 401);
  const voterHash = hashVoter(cookieId);

  try {
    const store = getStore();
    const dilemma = await store.getDilemmaBySlug(body.slug);
    if (!dilemma || dilemma.status !== 'published') return json({ error: 'This dilemma is not available.' }, 404);
    const closeAt = effectiveCloseAt(dilemma.closesAt, await store.getLatestDailyClose(dilemma.id));
    const votedSide = await store.getVote(dilemma.id, voterHash);
    if (!votedSide) return json({ error: 'Vote on this dilemma first.' }, 403);

    if (body.action === 'submit') {
      const side = parseSide(body.side);
      const validated = validateDefense(body.body);
      if (!side) return json({ error: 'Choose the side you did not pick.' }, 422);
      if (!validated.ok) return json({ error: validated.error }, 422);
      if (side === votedSide) return json({ error: 'Defend the side you did not pick.' }, 422);
      if (await store.getDefense(dilemma.id, voterHash))
        return json({ error: 'You already submitted your one-line defense.' }, 409);
      const defense = await store.createDefense(dilemma.id, voterHash, side, validated.value);
      return NextResponse.json({ ok: true, defense });
    }

    if (body.action === 'endorse') {
      if (!isClosed({ closesAt: closeAt }))
        return json({ error: 'Endorsements open when the vote closes.' }, 409);
      if (typeof body.defenseId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.defenseId))
        return json({ error: 'Choose a valid defense.' }, 400);
      const result = await store.endorseDefense(dilemma.id, body.defenseId, voterHash);
      return NextResponse.json({ ok: true, ...result });
    }

    return json({ error: 'Choose a valid defense action.' }, 400);
  } catch {
    return json({ error: 'We couldn\u2019t save that defense. Try again.' }, 500);
  }
}
