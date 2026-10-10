import { cookies } from 'next/headers';
import { hashVoter, VOTER_COOKIE } from '@/lib/auth';
import { parseFmt, takeCard } from '@/lib/cards';
import { computeTake } from '@/lib/alignment';
import { getStore } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const fmt = parseFmt(new URL(req.url).searchParams.get('fmt'), 'story');
  const id = cookies().get(VOTER_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return new Response('Vote first', { status: 404 });
  const store = getStore();
  const history = await store.getVoterHistory(hashVoter(id));
  const counts = await store.getCounts(history.map((h) => h.dilemmaId));
  const t = computeTake(history, counts);
  if (t.pct === null || !t.label) return new Response('Not enough votes yet', { status: 404 });
  return takeCard({ fmt, pct: t.pct, withCrowd: t.withCrowd, considered: t.considered, label: t.label });
}
