export const ROOM_RE = /^[a-z0-9]{6}$/;

export function parseRoom(v: unknown): string | null {
  return typeof v === 'string' && ROOM_RE.test(v) ? v : null;
}

/** Client-side: a random 6-character room code. Rooms need no server record. */
export function newRoomCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
