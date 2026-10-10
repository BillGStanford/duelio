import { clientIp, json, readJson, sameOrigin } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { EVENT_NAMES } from '@/lib/events';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'blocked' }, 403);
  if (!rateLimit(`events:${clientIp(req)}`, 120, 60_000)) return json({ ok: true });

  let body: Record<string, unknown>;
  try {
    body = (await readJson(req, 2_000)) as Record<string, unknown>;
  } catch {
    return json({ ok: false }, 400);
  }
  const name = body?.name;
  if (typeof name !== 'string' || !EVENT_NAMES.has(name)) return json({ ok: false }, 400);

  const props: Record<string, string | number | boolean> = {};
  const raw = body.props && typeof body.props === 'object' ? (body.props as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(raw).slice(0, 6)) {
    if (k.length > 30) continue;
    if (typeof v === 'string') props[k] = v.slice(0, 100);
    else if (typeof v === 'number' || typeof v === 'boolean') props[k] = v;
  }
  try {
    await getStore().logEvent(name, props);
  } catch {
    /* analytics must never break the product */
  }
  return json({ ok: true });
}
