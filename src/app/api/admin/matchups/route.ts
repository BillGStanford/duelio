import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, isAdminCookie } from '@/lib/auth';
import { clientIp, sameOrigin } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { adminCloseRound, adminUpdateMatchup, createMatchup } from '@/lib/matchups';

export const dynamic = 'force-dynamic';
const str = (f: FormData, key: string) => typeof f.get(key) === 'string' ? String(f.get(key)).trim() : '';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new NextResponse('Cross-site request blocked.', { status: 403 });
  if (!isAdminCookie(cookies().get(ADMIN_COOKIE)?.value)) return new NextResponse('Unauthorized', { status: 401 });
  if (!rateLimit(`admin-matchups:${clientIp(req)}`, 60, 60_000)) return new NextResponse('Too many actions.', { status: 429 });
  const form = await req.formData();
  const action = str(form, 'action');
  const done = (message: string) => NextResponse.redirect(new URL(`/admin/matchups?msg=${encodeURIComponent(message)}`, req.url), 303);
  try {
    if (action === 'create') {
      const a = str(form, 'nameA').slice(0, 100);
      const b = str(form, 'nameB').slice(0, 100);
      const m = await createMatchup(a, b);
      return done(`Matchup ready: /matchup/${m.slug}`);
    }
    const id = str(form, 'id');
    const status = str(form, 'status');
    if (action === 'update') {
      const patch: Record<string, unknown> = {};
      for (const [formKey, dbKey, max] of [
        ['nameA','name_a',100],['nameB','name_b',100],
        ['descriptionA','description_a',360],['descriptionB','description_b',360],
        ['imageA','image_a',1000],['imageB','image_b',1000],
      ] as const) {
        const value = str(form, formKey);
        if (value.length > max) return done(`${formKey} is too long.`);
        patch[dbKey] = value;
      }
      if (!String(patch.name_a).trim() || !String(patch.name_b).trim() || String(patch.name_a).toLocaleLowerCase() === String(patch.name_b).toLocaleLowerCase())
        return done('Enter two different competitor names.');
      await adminUpdateMatchup(id, patch);
      return done('Matchup details saved.');
    }
    if (action === 'status' && (status === 'published' || status === 'removed')) {
      await adminUpdateMatchup(id, { status });
      return done(status === 'published' ? 'Matchup restored.' : 'Matchup removed from public view.');
    }
    if (action === 'close_round') {
      await adminCloseRound(id);
      return done('Round closed, result recorded, and next round opened.');
    }
    return done('Unknown action.');
  } catch (error) {
    return done(error instanceof Error ? error.message.slice(0, 160) : 'Action failed.');
  }
}
