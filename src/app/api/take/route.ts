import { cookies } from 'next/headers';
import { computeTake } from '@/lib/alignment';
import { hashVoter, VOTER_COOKIE } from '@/lib/auth';
import { json } from '@/lib/http';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const id = cookies().get(VOTER_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return json({ considered: 0, withCrowd: 0, pct: null, label: null, unlockIn: 3 }, 200, { 'Cache-Control': 'no-store' });
  try {
    const store = getStore();
    const history = await store.getVoterHistory(hashVoter(id));
    const counts = await store.getCounts(history.map((h) => h.dilemmaId));
    return json(computeTake(history, counts), 200, { 'Cache-Control': 'no-store' });
  } catch {
    return json({ error: 'unavailable' }, 500);
  }
}
