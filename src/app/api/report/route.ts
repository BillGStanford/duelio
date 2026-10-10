import { clientIp, json, readJson, sameOrigin } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { getStore } from '@/lib/store';
import { validateReport } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Cross-site request blocked.' }, 403);
  if (!rateLimit(`report:${clientIp(req)}`, 10, 60 * 60_000))
    return json({ error: 'Too many reports from this connection. Try again later.' }, 429);

  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return json({ error: 'We couldn\u2019t read that report.' }, 400);
  }
  const v = validateReport(body);
  if (!v.ok) return json({ error: v.error }, 422);

  try {
    const store = getStore();
    const d = await store.getDilemmaBySlug(v.value.slug);
    if (!d) return json({ error: 'Unknown dilemma.' }, 404);
    await store.createReport({ targetType: v.value.targetType, targetId: d.slug, reason: v.value.reason });
    return json({ ok: true });
  } catch {
    return json({ error: 'We couldn\u2019t send that report. Try again.' }, 500);
  }
}
