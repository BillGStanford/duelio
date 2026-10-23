'use client';

import { forwardRef, memo, useEffect, useImperativeHandle, useRef, type MouseEvent } from 'react';
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

function ArticleViewBase({ title, html, thumbnail, disabled, onNavigate, onBlocked }: Props, ref: React.Ref<ArticleHandle>) {
  const scroller = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);

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
      hits[0]?.a.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return hits.length > 0;
    },
  }), []);

  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [title]);

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor) return;
    event.preventDefault();
    if (disabled) return;
    const href = anchor.getAttribute('href') || '';
    if (href.startsWith('#')) {
      const id = decodeURIComponent(href.slice(1));
      const el = id ? body.current?.querySelector(`[id="${CSS.escape(id)}"]`) : null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      <article className="mx-auto max-w-4xl px-4 pb-24 pt-6 sm:px-8 sm:pt-8">
        <h1 className="wr-title border-b border-[#a2a9b1] pb-3 text-3xl font-normal sm:text-5xl">{title}</h1>
        {thumbnail && <p className="sr-only">Lead image available on the full page.</p>}
        <div ref={body} className="wr-article mt-5" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
        <p className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
          Article text from Wikipedia, available under CC BY-SA 4.0. WikiRush by Duelio is not affiliated with the Wikimedia Foundation.
        </p>
      </article>
    </div>
  );
}

const ArticleView = memo(forwardRef(ArticleViewBase));
export default ArticleView;
