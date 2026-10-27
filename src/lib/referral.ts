// Friend-invite codes: a link like /wikirush?ref=abc123 is remembered across pages until the visitor signs up.
const KEY = 'duelio:ref';
export const cleanRef = (v: string | null | undefined) => (v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);

export function storedRef(): string {
  try { return cleanRef(localStorage.getItem(KEY)); } catch { return ''; }
}
export function rememberRef(code: string) {
  try { localStorage.setItem(KEY, cleanRef(code)); } catch { /* storage blocked */ }
}
export function forgetRef() {
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}
