import { clientIp, json, readJson, sameOrigin } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { getStore } from '@/lib/store';
import { containsPersonalInfo, slugify, validateSubmission } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Cross-site request blocked.' }, 403);
  if (!rateLimit(`submit:${clientIp(req)}`, 5, 60 * 60_000))
    return json({ error: 'You\u2019ve sent a few already. Try again in an hour.' }, 429);

  let body: Record<string, unknown>;
  try {
    body = (await readJson(req)) as Record<string, unknown>;
  } catch {
    return json({ error: 'We couldn\u2019t read that submission.' }, 400);
  }

  // Honeypot: real people never fill this field. Pretend it worked.
  if (typeof body?.website === 'string' && body.website.trim() !== '') return json({ ok: true });

  const v = validateSubmission(body);
  if (!v.ok) return json({ error: v.error }, 422);

  try {
    const store = getStore();
    const baseSlug = slugify(v.value.question);
    let slug = baseSlug;
    for (let suffix = 2; await store.slugExists(slug); suffix += 1) {
      const ending = `-${suffix}`;
      slug = `${baseSlug.slice(0, 80 - ending.length)}${ending}`;
    }
    const dilemma = await store.createDilemma({
      slug,
      question: v.value.question,
      context: v.value.context,
      sideALabel: 'Yes',
      sideADescription: v.value.sideA,
      sideBLabel: 'No',
      sideBDescription: v.value.sideB,
      status: 'published',
      editorial: false,
      submittedBy: v.value.submitterName && !containsPersonalInfo(v.value.submitterName)
        ? v.value.submitterName
        : null,
      closesAt: null,
    });
    return json({ ok: true, slug: dilemma.slug });
  } catch {
    return json({ error: 'We couldn\u2019t save your dilemma. Try again.' }, 500);
  }
}
