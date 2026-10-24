import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, isAdminCookie } from '@/lib/auth';
import { redirectTo, sameOrigin } from '@/lib/http';
import { cleanFeatured } from '@/lib/wikirush/featured';
import { createFeatured, deleteFeatured, setFeaturedActive } from '@/lib/wikirush/featuredStore';

export const dynamic = 'force-dynamic';

const str = (f: FormData, k: string) => (typeof f.get(k) === 'string' ? (f.get(k) as string) : '');

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new NextResponse('Cross-site request blocked.', { status: 403 });
  if (!isAdminCookie(cookies().get(ADMIN_COOKIE)?.value)) return new NextResponse('Unauthorized', { status: 401 });
  const form = await req.formData();
  const done = (msg: string) => redirectTo(req, `/admin/wikirush?msg=${encodeURIComponent(msg)}`);
  try {
    switch (str(form, 'action')) {
      case 'create': {
        let pairs: unknown = [];
        try { pairs = JSON.parse(str(form, 'pairs')); } catch { return done('Rounds could not be read. Try again.'); }
        const checked = cleanFeatured({ title: str(form, 'title'), blurb: str(form, 'blurb'), pairs, seconds: str(form, 'seconds'), day: str(form, 'day'), active: str(form, 'active') === 'on' });
        if (!checked.ok) return done(checked.error);
        const item = await createFeatured(checked.value);
        return done(`Created Day ${item.day} Challenge “${item.title}” with ${item.pairs.length} round${item.pairs.length === 1 ? '' : 's'}.${item.active ? ' It is live in the WikiRush lobby.' : ' It is hidden.'}`);
      }
      case 'show': await setFeaturedActive(str(form, 'id'), true); return done('Challenge is live.');
      case 'hide': await setFeaturedActive(str(form, 'id'), false); return done('Challenge hidden.');
      case 'delete': await deleteFeatured(str(form, 'id')); return done('Challenge deleted.');
      default: return done('Unknown action.');
    }
  } catch (e) {
    return done(e instanceof Error ? e.message : 'Something went wrong.');
  }
}
