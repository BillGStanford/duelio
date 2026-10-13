'use client';

import Link from 'next/link';
import EntityImage from './EntityImage';
import { useRef, useState } from 'react';

export interface MatchupSlide {
  id: string;
  slug: string;
  nameA: string;
  nameB: string;
  descriptionA: string;
  descriptionB: string;
  imageA: string;
  imageB: string;
  roundNumber: number | null;
  votesA: number;
  votesB: number;
}

export default function MatchupCarousel({ matchups }: { matchups: MatchupSlide[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, startScroll: 0, lastX: 0, lastTime: 0, velocity: 0, moved: false });
  const suppressClick = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const total = matchups.length;
  const slideCount = total + 1;

  function goTo(index: number) {
    const rail = railRef.current;
    if (!rail) return;
    const slides = Array.from(rail.querySelectorAll<HTMLElement>('[data-carousel-slide]'));
    const next = Math.max(0, Math.min(index, slides.length - 1));
    const target = slides[next];
    if (!target) return;
    rail.scrollTo({ left: target.offsetLeft - slides[0].offsetLeft, behavior: 'smooth' });
    setActiveIndex(next);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // Interactive controls must receive normal pointer/click behavior, not carousel drag capture.
    if ((event.target as HTMLElement).closest('a, button, input, textarea, select')) return;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const rail = railRef.current;
    if (!rail) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      active: true, startX: event.clientX, startScroll: rail.scrollLeft,
      lastX: event.clientX, lastTime: performance.now(), velocity: 0, moved: false,
    };
    suppressClick.current = false;
    rail.classList.add('is-dragging');
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const rail = railRef.current;
    if (!drag.active || !rail) return;
    const now = performance.now();
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 5) drag.moved = true;
    if (!drag.moved) return;
    event.preventDefault();
    rail.scrollLeft = drag.startScroll - delta;
    const dt = Math.max(1, now - drag.lastTime);
    drag.velocity = (drag.lastX - event.clientX) / dt;
    drag.lastX = event.clientX;
    drag.lastTime = now;
  }

  function onPointerUp() {
    const drag = dragRef.current;
    const rail = railRef.current;
    if (!drag.active || !rail) return;
    drag.active = false;
    rail.classList.remove('is-dragging');
    if (drag.moved) {
      suppressClick.current = true;
      const slides = Array.from(rail.querySelectorAll<HTMLElement>('[data-carousel-slide]'));
      if (slides.length) {
        const current = rail.scrollLeft + slides[0].offsetLeft;
        let nearest = 0;
        let distance = Number.POSITIVE_INFINITY;
        slides.forEach((slide, index) => {
          const d = Math.abs(slide.offsetLeft - current);
          if (d < distance) { distance = d; nearest = index; }
        });
        if (Math.abs(drag.velocity) > 0.25) nearest += drag.velocity > 0 ? 1 : -1;
        goTo(Math.max(0, Math.min(nearest, slides.length - 1)));
      }
      window.setTimeout(() => { suppressClick.current = false; }, 80);
    }
  }

  function onClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function onScroll() {
    const rail = railRef.current;
    if (!rail) return;
    const slides = Array.from(rail.querySelectorAll<HTMLElement>('[data-carousel-slide]'));
    if (!slides.length) return;
    const current = rail.scrollLeft + slides[0].offsetLeft;
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    slides.forEach((slide, index) => {
      const d = Math.abs(slide.offsetLeft - current);
      if (d < distance) { distance = d; nearest = index; }
    });
    setActiveIndex(nearest);
  }

  return (
    <div className="matchup-carousel mt-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-mute">Drag to explore <span aria-hidden="true">·</span> {Math.min(activeIndex + 1, slideCount)} of {slideCount}</p>
        <div className="flex shrink-0 gap-2">
          <button type="button" aria-label="Previous matchup" onClick={() => goTo(activeIndex - 1)} disabled={activeIndex === 0} className="carousel-arrow">←</button>
          <button type="button" aria-label="Next matchup" onClick={() => goTo(activeIndex + 1)} disabled={activeIndex >= slideCount - 1} className="carousel-arrow">→</button>
        </div>
      </div>
      <div className="carousel-viewport relative">
        <div
          ref={railRef}
          className="matchup-carousel-rail"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClickCapture={onClickCapture}
          onScroll={onScroll}
        >
          {matchups.map((m, index) => {
            const totalVotes = m.votesA + m.votesB;
            const pctA = totalVotes ? Math.round(m.votesA / totalVotes * 100) : 50;
            const pctB = 100 - pctA;
            return (
              <article key={m.id} data-carousel-slide className="matchup-slide-card">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className="carousel-kicker">MATCHUP {String(index + 1).padStart(2, '0')}</span>
                  <span className="text-xs font-bold text-mute">{m.roundNumber ? `Round ${m.roundNumber}` : 'Round starting soon'}</span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3">
                  <div className="matchup-competitor matchup-competitor-a min-w-0">
                    <EntityImage src={m.imageA} name={m.nameA} className="matchup-portrait matchup-portrait-a aspect-[4/3] h-auto w-full border border-rule bg-[#11172a] object-cover" />
                    <h3 className="matchup-name mt-3 line-clamp-2">{m.nameA}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-mute">{m.descriptionA}</p>
                  </div>
                  <span className="matchup-vs-badge mt-12 rounded-full bg-[#f0f1f7] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-mute">VS</span>
                  <div className="matchup-competitor matchup-competitor-b min-w-0">
                    <EntityImage src={m.imageB} name={m.nameB} className="matchup-portrait matchup-portrait-b aspect-[4/3] h-auto w-full border border-rule bg-[#fff0f4] object-cover" />
                    <h3 className="matchup-name mt-3 line-clamp-2 text-right">{m.nameB}</h3>
                    <p className="mt-1 line-clamp-2 text-right text-sm text-mute">{m.descriptionB}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between gap-2 text-sm font-extrabold">
                  <span className="text-sidea">{pctA}% <span className="font-semibold text-mute">· {m.votesA}</span></span>
                  <span className="text-xs font-semibold text-mute">{totalVotes} votes</span>
                  <span className="text-sideb">{pctB}% <span className="font-semibold text-mute">· {m.votesB}</span></span>
                </div>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#fff1f4]"><span className="bg-sidea" style={{ width: `${pctA}%` }} /><span className="bg-sideb" style={{ width: `${pctB}%` }} /></div>
                <a href={`/matchup/${m.slug}`} data-enter-matchup="true" draggable={false} onClick={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); } }} className="matchup-slide-cta mt-5">Enter matchup <span aria-hidden="true">→</span></a>
              </article>
            );
          })}
          <article data-carousel-slide className="matchup-slide-card matchup-more-card">
            <div className="more-glow" aria-hidden="true" />
            <span className="carousel-kicker">THAT’S JUST THE START</span>
            <p className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl">{total} matchups explored. More to settle.</p>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-mute">Explore the full arena, discover new face-offs, and cast your vote on every published matchup.</p>
            <Link href="/matchups" draggable={false} className="matchup-slide-cta mt-7">Explore all matchups <span aria-hidden="true">→</span></Link>
          </article>
        </div>
        <div className="carousel-edge carousel-edge-left" aria-hidden="true" />
        <div className="carousel-edge carousel-edge-right" aria-hidden="true" />
      </div>
      <div className="mt-4 flex items-center gap-1.5" aria-label={`Slide ${activeIndex + 1} of ${slideCount}`}>
        {Array.from({ length: slideCount }, (_, i) => (
          <button key={i} type="button" aria-label={`Go to slide ${i + 1}`} onClick={() => goTo(i)} className={`carousel-dot ${activeIndex === i ? 'carousel-dot-active' : ''}`} />
        ))}
      </div>
    </div>
  );
}
