// Guest gate: one free game without an account, then sign-up. Everything here is pure or
// storage-only so it can be unit tested. The server half lives in /api/wikirush/guest.
//
// This is a conversion gate, not a security boundary: a determined person can clear their
// storage, change browsers AND networks. The fingerprint just makes a new tab, a refresh or
// incognito mode not work as an escape hatch.
import type { GameSummary } from './types';

export const GUEST_FREE_GAMES = 1;

export type GuestIds = { fp: string; hw: string };

/** Server decision: the claim keys are salted hashes, never raw identifiers. */
export function claimKeys(ids: GuestIds, ipHash: string): string[] {
  const keys: string[] = [];
  if (/^[a-f0-9]{16,64}$/.test(ids.fp)) keys.push(`fp:${ids.fp}`);
  // Hardware alone collides between identical phones; paired with the network it does not.
  if (/^[a-f0-9]{16,64}$/.test(ids.hw)) keys.push(`hwip:${ids.hw}:${ipHash}`);
  return keys;
}

export function isUsed(existing: readonly string[], keys: readonly string[]): boolean {
  const have = new Set(existing);
  return keys.some(k => have.has(k));
}

export type GateInput = { configured: boolean; signedIn: boolean; usedLocally: boolean; usedOnServer: boolean };

export function mustSignUp({ configured, signedIn, usedLocally, usedOnServer }: GateInput): boolean {
  if (!configured || signedIn) return false;
  return usedLocally || usedOnServer;
}

// ---------- local state ----------
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const USED_KEY = 'wikirush:v2:guest-used';
const PENDING_KEY = 'wikirush:v2:pending';
const MAX_PENDING = 3;

function store(): StorageLike | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

export function guestUsedLocally(s: StorageLike | null = store()): boolean {
  try { return !!s && Number(s.getItem(USED_KEY) || 0) >= GUEST_FREE_GAMES; } catch { return false; }
}

export function markGuestUsed(s: StorageLike | null = store()) {
  try { s?.setItem(USED_KEY, String(GUEST_FREE_GAMES)); } catch { /* storage blocked */ }
  try { document.cookie = `wr_guest=1; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`; } catch { /* no cookies */ }
}

export function guestUsedCookie(): boolean {
  try { return /(?:^|; )wr_guest=1/.test(document.cookie); } catch { return false; }
}

/** Finished guest games wait here until the player has an account; nothing is lost on sign-up. */
export function loadPending(s: StorageLike | null = store()): GameSummary[] {
  try {
    const raw = s?.getItem(PENDING_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(g => g && g.settings && Array.isArray(g.results)).slice(-MAX_PENDING) : [];
  } catch { return []; }
}

export function addPending(game: GameSummary, s: StorageLike | null = store()) {
  try { s?.setItem(PENDING_KEY, JSON.stringify([...loadPending(s), game].slice(-MAX_PENDING))); } catch { /* storage blocked */ }
}

export function clearPending(s: StorageLike | null = store()) {
  try { s?.removeItem(PENDING_KEY); } catch { /* ignore */ }
}
