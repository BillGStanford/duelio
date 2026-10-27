'use client';

import { forwardRef, memo, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { hrefFragment, normTitle, titleFromHref } from '@/lib/wikirush/titles';

export type ArticleHandle = {
  /** Does the page currently on screen link straight to this title? */
  linksTo(title: string): boolean;
  /** Highlights links to the title and scrolls the first into view. Returns whether any exist. */
  radar(title: string): boolean;
};

type Props = {
  title: string;
  html: string;
  thumbnail?: string;
  disabled: boolean;
  onNavigate(title: string): void;
  /** Pointer is over (or finger is on) a link: the player is probably about to click it. */
  onHint?(title: string): void;
  onBlocked(message: string): void;
};

// Content that is hidden by CSS (navboxes, references...) is not playable, so it never counts.
const HIDDEN = '.navbox, .navbox-styles, .reflist, .mw-references-wrap, .references, .hatnote, .sistersitebox, .metadata, .ambox, .noprint, .mw-editsection, .sidebar, .vertical-navbox, [role="navigation"]';

function playableAnchors(root: HTMLElement): Array<{ a: HTMLAnchorElement; title: string }> {
  const out: Array<{ a: HTMLAnchorElement; title: string }> = [];
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(a => {
    if (a.closest(HIDDEN)) return;
    const title = titleFromHref(a.getAttribute('href'));
    if (title) out.push({ a, title });
  });
  return out;
}

function openFoldsAround(el: Element | null) {
  let n: Element | null = el;
  while (n) { if (n.classList?.contains('wr-fold')) n.setAttribute('data-open', '1'); n = n.parentElement; }
}

const FOLD_KEY = 'wikirush:v2:fold';

function ArticleViewBase({ title, html, thumbnail, disabled, onNavigate, onHint, onBlocked }: Props, ref: React.Ref<ArticleHandle>) {
  const scroller = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [folded, setFolded] = useState(true);
  const [query, setQuery] = useState('');
  const [foldable, setFoldable] = useState(false);
  const finder = useRef<HTMLInputElement>(null);
  useEffect(() => { try { if (localStorage.getItem(FOLD_KEY) === '0') setFolded(false); } catch { /* ignore */ } }, []);

  useImperativeHandle(ref, () => ({
    linksTo(target) {
      if (!body.current) return false;
      const want = normTitle(target);
      return playableAnchors(body.current).some(x => normTitle(x.title) === want);
    },
    radar(target) {
      if (!body.current) return false;
      const want = normTitle(target);
      const hits = playableAnchors(body.current).filter(x => normTitle(x.title) === want);
      hits.forEach(x => x.a.classList.add('wr-radar'));
      openFoldsAround(hits[0]?.a ?? null);
      hits[0]?.a.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return hits.length > 0;
    },
  }), []);

  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); setQuery(''); }, [title]);

  // Inject the article ourselves (layout effect) so later re-renders can never wipe the fold markup.
  useLayoutEffect(() => { if (body.current) body.current.innerHTML = html; }, [html]);

  // Long pages: fold every section after the intro behind its heading (with a link count) so the page is short.
  useEffect(() => {
    const root = body.current; if (!root) return;
    const secs = Array.from(root.querySelectorAll<HTMLElement>(':scope > section')).filter(sec => sec.querySelector(':scope > h2'));
    setFoldable(secs.length >= 3);
    secs.forEach(sec => {
      sec.classList.add('wr-fold');
      sec.setAttribute('data-open', folded && secs.length >= 3 ? '0' : '1');
      const h = sec.querySelector(':scope > h2'); if (!h) return;
      if (!h.querySelector('.wr-count')) {
        const n = playableAnchors(sec).length;
        const badge = document.createElement('span'); badge.className = 'wr-count'; badge.textContent = n ? `${n} link${n === 1 ? '' : 's'}` : '';
        h.appendChild(badge);
      }
    });
  }, [html, folded]);

  // Press / to jump to the link finder.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || disabled) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
      e.preventDefault(); finder.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled]);

  const matches = useMemo(() => {
    const q = normTitle(query);
    if (q.length < 2 || !body.current) return [] as string[];
    const seen = new Map<string, number>();
    for (const { a, title: t } of playableAnchors(body.current)) {
      const hay = `${normTitle(t)} ${normTitle(a.textContent || '')}`;
      if (!hay.includes(q)) continue;
      const rank = normTitle(t).startsWith(q) ? 0 : 1;
      if (!seen.has(t) || (seen.get(t) as number) > rank) seen.set(t, rank);
    }
    return Array.from(seen.entries()).sort((x, y) => x[1] - y[1] || x[0].length - y[0].length).slice(0, 12).map(x => x[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, html]);

  function hint(event: { target: EventTarget }) {
    if (!onHint || disabled) return;
    const anchor = (event.target as HTMLElement).closest?.('a');
    const next = anchor ? titleFromHref(anchor.getAttribute('href')) : null;
    if (next) onHint(next);
  }

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const heading = target.closest('h2');
    if (heading && !target.closest('a') && heading.parentElement?.classList.contains('wr-fold')) {
      const sec = heading.parentElement;
      sec.setAttribute('data-open', sec.getAttribute('data-open') === '1' ? '0' : '1');
      return;
    }
    const anchor = target.closest('a');
    if (!anchor) return;
    event.preventDefault();
    if (disabled) return;
    const href = anchor.getAttribute('href') || '';
    if (href.startsWith('#')) {
      const id = decodeURIComponent(href.slice(1));
      const el = id ? body.current?.querySelector(`[id="${CSS.escape(id)}"]`) : null;
      openFoldsAround(el ?? null); el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const next = titleFromHref(href);
    if (!next) { onBlocked(/^(https?:)?\/\//.test(href) ? 'Only Wikipedia article links count. No leaving the encyclopedia.' : 'That link is not a playable article.'); return; }
    // A link to a section of the page you are already on is not a move.
    if (normTitle(next) === normTitle(title) && hrefFragment(href)) {
      const el = body.current?.querySelector(`[id="${CSS.escape(hrefFragment(href))}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    onNavigate(next);
  }

  return (
    <div ref={scroller} className="wr-scroll min-h-0 flex-1 overflow-y-auto bg-white">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2 sm:px-8">
          <label className="sr-only" htmlFor="wr-find">Find a link on this page</label>
          <input id="wr-find" ref={finder} value={query} onChange={e => setQuery(e.target.value)} disabled={disabled} placeholder="Find a link on this page  ( / )" autoComplete="off"
            className="min-h-10 min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900 outline-none focus:border-[#6978f5] focus:bg-white" />
          {foldable && <button type="button" onClick={() => { const next = !folded; setFolded(next); try { localStorage.setItem(FOLD_KEY, next ? '1' : '0'); } catch { /* ignore */ } }}
            className="min-h-10 shrink-0 rounded-xl border-2 border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">{folded ? 'Expand all' : 'Fold sections'}</button>}
        </div>
        {query.trim().length >= 2 && <ul className="mx-auto max-w-4xl px-4 pb-2 sm:px-8" aria-label="Matching links">
          {matches.length === 0 ? <li className="py-1.5 text-sm text-slate-500">No links on this page match “{query.trim()}”.</li>
            : matches.map(m => <li key={m}><button type="button" onClick={() => onNavigate(m)} disabled={disabled} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#0645ad] hover:bg-[#eef2ff]">{m} <span className="text-xs font-normal text-slate-400">→ go</span></button></li>)}
        </ul>}
      </div>
      <article className="mx-auto max-w-4xl px-4 pb-24 pt-6 sm:px-8 sm:pt-8">
        <h1 className="wr-title border-b border-[#a2a9b1] pb-3 text-3xl font-normal sm:text-5xl">{title}</h1>
        {thumbnail && <p className="sr-only">Lead image available on the full page.</p>}
        <div ref={body} className="wr-article mt-5" onClick={onClick} onPointerOver={hint} onPointerDown={hint} onTouchStart={hint} onFocus={hint} />
        <p className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
          Article text from Wikipedia, available under CC BY-SA 4.0. WikiRush by Duelio is not affiliated with the Wikimedia Foundation.
        </p>
      </article>
    </div>
  );
}

const ArticleView = memo(forwardRef(ArticleViewBase));
export default ArticleView;
