import { createHash, createHmac, timingSafeEqual } from 'crypto';

export const ADMIN_COOKIE = 'duelio_admin';
export const VOTER_COOKIE = 'duelio_vid';

export function adminEnabled(): boolean {
  return !!process.env.ADMIN_PASSWORD;
}

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
}

export function sessionToken(): string {
  return createHmac('sha256', secret()).update('duelio-admin-session').digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPassword(input: string): boolean {
  if (!adminEnabled()) return false;
  return safeEqual(input, process.env.ADMIN_PASSWORD as string);
}

export function isAdminCookie(value: string | undefined): boolean {
  if (!adminEnabled() || !value) return false;
  return safeEqual(value, sessionToken());
}

/** Votes store a salted hash, never the raw browser identifier. */
export function hashVoter(rawId: string): string {
  const salt = process.env.VOTE_SALT || 'duelio-default-salt';
  return createHmac('sha256', salt).update(rawId).digest('hex');
}
