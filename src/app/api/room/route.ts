import { cookies } from 'next/headers';
import { hashVoter, VOTER_COOKIE } from '@/lib/auth';
import { clientIp, json, readJson, sameOrigin } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { computeResults } from '@/lib/results';
import { parseRoom } from '@/lib/room';
import { getStore } from '@/lib/store';
import { isValidSlug } from '@/lib/validate';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

function voterHash(): string | null {
  const id = cookies().get(VOTER_COOKIE)?.value;
  return id && /^[0-9a-f-]{36}$/.test(id) ? hashVoter(id) : null;
}

/** Live group tally. The split is only revealed to people who voted in this room. */
export async function GET(req: Request) {
  if (!rateLimit(`room:${clientIp(req)}`, 90, 60_000)) return json({ error: 'slow down' }, 429, NO_STORE);
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  const room = parseRoom(url.searchParams.get('g'));
  if (!isValidSlug(slug) || !room) return json({ error: 'bad request' }, 400, NO_STORE);
  try {
    const store = getStore();
    const d = await store.getDilemmaBySlug(slug);
    if (!d || d.status !== 'published') return json({ error: 'not found' }, 404, NO_STORE);
    const counts = await store.getRoomCounts(d.id, room);
    const h = voterHash();
    const detail = h ? await store.getVoteDetail(d.id, h) : null;
    const inRoom = !!detail && detail.room === room;
    return json(
      { total: counts.a + counts.b, inRoom, voted: !!detail, results: inRoom ? computeResults(counts) : null },
      200,
      NO_STORE,
    );
  } catch {
    return json({ error: 'unavailable' }, 500, NO_STORE);
  }
}

/** Count an existing vote toward this room (for people who voted before opening the link). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Cross-site request blocked.' }, 403);
  if (!rateLimit(`roomjoin:${clientIp(req)}`, 30, 60_000)) return json({ error: 'Slow down.' }, 429);
  let body: Record<string, unknown>;
  try {
    body = (await readJson(req, 1_000)) as Record<string, unknown>;
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const room = parseRoom(body?.room);
  if (!isValidSlug(body?.slug) || !room) return json({ error: 'Bad request.' }, 400);
  const h = voterHash();
  if (!h) return json({ error: 'Vote first.' }, 409);
  try {
    const store = getStore();
    const d = await store.getDilemmaBySlug(body.slug as string);
    if (!d || d.status !== 'published') return json({ error: 'Not found.' }, 404);
    const joined = await store.joinRoom(d.id, h, room);
    return joined ? json({ ok: true }) : json({ error: 'Your vote is already counted in a group.' }, 409);
  } catch {
    return json({ error: 'We couldn\u2019t add your vote to the group. Try again.' }, 500);
  }
}
