// Title and link helpers shared by the game, the radar and the tests.

const NAMESPACE = /^(file|image|category|help|special|wikipedia|wp|project|template|portal|talk|user|draft|module|mediawiki|timedtext|book|media|topic|wikt|commons)( talk)?:/i;

/** Lower-cased, underscore-free, whitespace-collapsed key for comparing titles. */
export function normTitle(title: string): string {
  return title.normalize('NFC').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Turns a Wikipedia article link into a plain title, or null when it is not a playable
 * article link (other namespaces, red links, external sites, bare anchors).
 */
export function titleFromHref(href: string | null | undefined): string | null {
  if (!href) return null;
  let path: string;
  if (href.startsWith('./')) path = href.slice(2);
  else if (href.startsWith('/wiki/')) path = href.slice('/wiki/'.length);
  else {
    const match = href.match(/^(?:https?:)?\/\/(?:en\.)?wikipedia\.org\/wiki\/(.+)$/i);
    if (!match) return null;
    path = match[1];
  }
  if (/[?&]redlink=1/.test(path) || /[?&]action=edit/.test(path)) return null;
  path = path.split('#')[0].split('?')[0];
  if (!path) return null;
  let title: string;
  try { title = decodeURIComponent(path); } catch { return null; }
  title = title.replace(/_/g, ' ').trim();
  if (!title || NAMESPACE.test(title)) return null;
  return title;
}

/** The #fragment of a link, if any (decoded, without the hash). */
export function hrefFragment(href: string | null | undefined): string {
  if (!href) return '';
  const i = href.indexOf('#');
  if (i < 0) return '';
  try { return decodeURIComponent(href.slice(i + 1)); } catch { return href.slice(i + 1); }
}

/** Every playable article title linked from a chunk of article HTML (de-duplicated). */
export function linkedTitles(html: string): string[] {
  const seen = new Map<string, string>();
  const re = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const title = titleFromHref((m[1] ?? m[2] ?? '').replace(/&amp;/g, '&'));
    if (title) {
      const key = normTitle(title);
      if (!seen.has(key)) seen.set(key, title);
    }
  }
  return Array.from(seen.values());
}

/** True when the article HTML contains a link straight to the target. */
export function htmlLinksTo(html: string, target: string): boolean {
  const want = normTitle(target);
  return linkedTitles(html).some(t => normTitle(t) === want);
}

/** Last path segment of a Wikipedia article URL, decoded. Used to read a canonical title after redirects. */
export function titleFromUrl(url: string): string | null {
  const match = url.match(/\/page\/([^/?#]+)(?:\/html)?(?:[?#].*)?$/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]).replace(/_/g, ' '); } catch { return null; }
}
