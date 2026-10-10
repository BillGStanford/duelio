import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminEnabled, checkPassword, sessionToken } from '@/lib/auth';
import { clientIp, redirectTo, sameOrigin } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new NextResponse('Cross-site request blocked.', { status: 403 });
  if (!adminEnabled()) return redirectTo(req, '/admin/login?error=disabled');
  if (!rateLimit(`login:${clientIp(req)}`, 10, 15 * 60_000)) return redirectTo(req, '/admin/login?error=rate');

  const form = await req.formData();
  const password = typeof form.get('password') === 'string' ? (form.get('password') as string) : '';
  if (!checkPassword(password)) return redirectTo(req, '/admin/login?error=1');

  const res = redirectTo(req, '/admin');
  const https = req.url.startsWith('https') || req.headers.get('x-forwarded-proto') === 'https';
  res.cookies.set(ADMIN_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: https,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
