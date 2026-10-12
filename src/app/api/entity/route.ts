import { clientIp, json } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { resolveEntity } from '@/lib/matchups';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  if (!rateLimit(`entity-lookup:${clientIp(req)}`, 30, 60_000))
    return json({ error: 'Too many lookups. Try again in a minute.' }, 429);
  const name = new URL(req.url).searchParams.get('name')?.trim().slice(0, 100) || '';
  if (name.length < 2) return json({ error: 'Enter a name.' }, 422);
  return json(await resolveEntity(name));
}
