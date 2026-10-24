// "Detail challenges": rounds hand-built on the admin desk (exact start page -> exact target page).
export type FeaturedPair = { start: string; target: string; blurb?: string };
export type Featured = {
  id: string;
  /** Release number shown as "Day N Challenge". */
  day: number;
  title: string;
  blurb: string;
  pairs: FeaturedPair[];
  seconds: number;
  active: boolean;
  createdAt: string;
};
export type FeaturedInput = Omit<Featured, 'id' | 'createdAt' | 'day'> & { day?: number };

export const dayLabel = (day: number) => `Day ${day} Challenge`;

const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const normalizeTitle = (v: unknown) => clean(v, 180).replace(/_/g, ' ');

export const FEATURED_ROUNDS = [1, 3, 5] as const;

/** Validates admin input. Returns the cleaned challenge or a human-readable error. */
export function cleanFeatured(raw: { title?: unknown; blurb?: unknown; pairs?: unknown; seconds?: unknown; active?: unknown; day?: unknown }): { ok: true; value: FeaturedInput } | { ok: false; error: string } {
  const title = clean(raw.title, 60);
  if (title.length < 3) return { ok: false, error: 'Give the challenge a name (3+ characters).' };
  const list = Array.isArray(raw.pairs) ? raw.pairs : [];
  const pairs: FeaturedPair[] = [];
  for (const p of list) {
    const start = normalizeTitle((p as FeaturedPair)?.start);
    const target = normalizeTitle((p as FeaturedPair)?.target);
    if (!start && !target) continue;
    if (!start || !target) return { ok: false, error: 'Every round needs both a FROM and a TO page.' };
    if (start.toLowerCase() === target.toLowerCase()) return { ok: false, error: `“${start}” can’t be both the start and the destination.` };
    const blurb = clean((p as FeaturedPair)?.blurb, 90);
    pairs.push({ start, target, ...(blurb ? { blurb } : {}) });
  }
  if (!(FEATURED_ROUNDS as readonly number[]).includes(pairs.length)) return { ok: false, error: `A challenge has 1, 3 or 5 rounds (you entered ${pairs.length}).` };
  const seconds = [45, 90, 180].includes(Number(raw.seconds)) ? Number(raw.seconds) : 90;
  const day = Math.floor(Number(raw.day));
  return { ok: true, value: { ...(day >= 1 && day <= 9999 ? { day } : {}), title, blurb: clean(raw.blurb, 160), pairs, seconds, active: raw.active !== false && raw.active !== 'off' } };
}

export const featuredSeed = (id: string) => `feat-${id.replace(/[^a-z0-9]/gi, '').slice(0, 16).toLowerCase()}`;
