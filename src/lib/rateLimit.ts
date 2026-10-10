// Best-effort, per-process rate limiting. Good enough to blunt casual abuse;
// it does not coordinate across serverless instances.
const buckets = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5000) {
    buckets.forEach((v, k) => {
      if (v.reset <= now) buckets.delete(k);
    });
  }
  const cur = buckets.get(key);
  if (!cur || cur.reset <= now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  cur.n += 1;
  return cur.n <= limit;
}
