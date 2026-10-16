'use client';

import { useEffect, useState } from 'react';
import MatchupHeroCard, { type FeaturedMatchup } from './MatchupHeroCard';

export default function FeaturedMatchupCarousel({ matchups }: { matchups: FeaturedMatchup[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || matchups.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % matchups.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, matchups.length]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, matchups.length - 1)));
  }, [matchups.length]);

  if (!matchups.length) return null;
  const active = matchups[activeIndex];

  function goTo(index: number) {
    setActiveIndex((index + matchups.length) % matchups.length);
  }

  return (
    <section aria-labelledby="featured-matchups-heading" className="mt-8 sm:mt-12">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.17em] text-sidea">Pick a side</p>
          <h2 id="featured-matchups-heading" className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">Featured matchups.</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-mute sm:text-base">Big names. Big questions. No verdict until you vote.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous featured matchup" onClick={() => goTo(activeIndex - 1)} className="grid h-11 w-11 place-items-center rounded-none border border-rule bg-white text-lg font-bold transition-colors hover:border-ink hover:bg-ink hover:text-white">←</button>
          <button type="button" aria-label="Next featured matchup" onClick={() => goTo(activeIndex + 1)} className="grid h-11 w-11 place-items-center rounded-full border border-rule bg-white text-lg font-bold transition-colors hover:border-ink hover:bg-ink hover:text-white">→</button>
        </div>
      </div>

      <div
        className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
        }}
      >
        <div key={active.id} className="featured-matchup-enter">
          <MatchupHeroCard matchup={active} index={activeIndex} total={matchups.length} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2" aria-label={`Featured matchup ${activeIndex + 1} of ${matchups.length}`}>
            {matchups.map((matchup, index) => (
              <button key={matchup.id} type="button" onClick={() => goTo(index)} aria-label={`Show featured matchup ${index + 1}: ${matchup.nameA} versus ${matchup.nameB}`} aria-current={index === activeIndex ? 'true' : undefined}
                className={`h-2 rounded-full transition-all duration-300 ${index === activeIndex ? 'w-8 bg-sidea' : 'w-2 bg-[#c9ceda] hover:bg-sidea/60'}`} />
            ))}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-mute">{paused ? 'Paused' : reducedMotion ? 'Manual navigation' : 'Auto-playing'} <span className="mx-1 text-rule">·</span> {String(activeIndex + 1).padStart(2, '0')} / {String(matchups.length).padStart(2, '0')}</span>
        </div>
      </div>
      <style jsx>{`
        .featured-matchup-enter { animation: featured-enter 420ms cubic-bezier(.2,.7,.2,1) both; }
        @keyframes featured-enter { from { opacity: .35; transform: translateY(7px) scale(.995); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (prefers-reduced-motion: reduce) { .featured-matchup-enter { animation: none; } }
      `}</style>
    </section>
  );
}
