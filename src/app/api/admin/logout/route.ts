import { NextResponse } from 'next/server';
import { ADMIN_COOKIE } from '@/lib/auth';
import { redirectTo, sameOrigin } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new NextResponse('Cross-site request blocked.', { status: 403 });
  const res = redirectTo(req, '/admin/login');
  res.cookies.set(ADMIN_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
