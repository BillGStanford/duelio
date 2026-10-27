// Server-side page previews (photo + one-line description) for challenge cards and share images.
export type Thumb = { title: string; description?: string; image?: string };

const BASE = () => process.env.WIKIRUSH_WIKI_BASE || 'https://en.wikipedia.org';
const UA = 'Duelio WikiRush/2.0 (https://duelio.ink; Wikipedia article-link game)';
const cache = new Map<string, { at: number; thumb: Thumb }>();
const TTL = 6 * 60 * 60 * 1000;

/** Larger rendition of a Wikimedia thumbnail URL when it follows the usual /NNNpx- pattern. */
export const upsizeThumb = (url: string, px = 600) => url.replace(/\/(\d{2,4})px-/, `/${px}px-`);

export async function fetchThumb(title: string): Promise<Thumb> {
  const key = title.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.thumb;
  let thumb: Thumb = { title };
  try {
    const res = await fetch(`${BASE()}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(3000), cache: 'no-store' });
    if (res.ok) {
      const d = (await res.json()) as { title?: string; description?: string; thumbnail?: { source?: string }; originalimage?: { source?: string } };
      thumb = { title: d.title || title, description: d.description, image: d.thumbnail?.source ? upsizeThumb(d.thumbnail.source) : d.originalimage?.source };
    }
  } catch { /* fall back to title only */ }
  cache.set(key, { at: Date.now(), thumb });
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  return thumb;
}

/** Image bytes as a data URL (PNG or JPEG only, which is all the share-image renderer accepts). */
export async function imageDataUrl(url: string | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(4000), cache: 'no-store' });
    const type = (res.headers.get('content-type') || '').split(';')[0];
    if (!res.ok || !/^image\/(png|jpeg)$/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 1_500_000) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch { return null; }
}

export async function previewPair(start: string, target: string) {
  const [a, b] = await Promise.all([fetchThumb(start), fetchThumb(target)]);
  return { start: a, target: b };
}
