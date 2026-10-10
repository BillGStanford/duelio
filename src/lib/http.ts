import { NextResponse } from 'next/server';

export function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(data, { status, headers });
}

export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim().slice(0, 64);
  return req.headers.get('x-real-ip')?.slice(0, 64) || 'local';
}

function requestHost(req: Request): string {
  return req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host;
}

/** Rejects cross-site browser POSTs. Non-browser clients (no Origin) pass. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === requestHost(req);
  } catch {
    return false;
  }
}

export function redirectTo(req: Request, path: string) {
  const proto =
    req.headers.get('x-forwarded-proto') || (requestHost(req).startsWith('localhost') ? 'http' : 'https');
  return NextResponse.redirect(`${proto}://${requestHost(req)}${path}`, 303);
}

export async function readJson(req: Request, maxBytes = 8_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error('too large');
  return JSON.parse(text);
}
