'use client';

import Link from 'next/link';
import { useState } from 'react';
import EntityImage from './EntityImage';

type CardMatchup = {
  matchup: {
    id: string; slug: string; nameA: string; nameB: string;
    descriptionA: string; descriptionB: string; imageA: string; imageB: string;
  };
  round: { roundNumber: number } | null;
  counts: { a: number; b: number };
};

export default function MatchupDirectoryGrid({ matchups }: { matchups: CardMatchup[] }) {
  const [compact, setCompact] = useState(false);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-mute">Browse the board and pick your side.</p>
        <div role="group" aria-label="Card density" className="flex shrink-0 border border-rule bg-white p-1">
          <button type="button" onClick={() => setCompact(false)} aria-pressed={!compact}
            className={`inline-flex min-h-9 items-center gap-2 px-3 text-xs font-extrabold transition-colors ${!compact ? 'bg-ink text-white' : 'text-mute hover:bg-paper'}`}>
            <span aria-hidden="true">▦</span> Comfortable
          </button>
          <button type="button" onClick={() => setCompact(true)} aria-pressed={compact}
            className={`inline-flex min-h-9 items-center gap-2 px-3 text-xs font-extrabold transition-colors ${compact ? 'bg-ink text-white' : 'text-mute hover:bg-paper'}`}>
            <span aria-hidden="true">☷</span> Compact
          </button>
        </div>
      </div>

      <div className={compact
        ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
        : 'grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 sm:gap-6'}>
        {matchups.map(({ matchup: m, round, counts }, index) => {
          const total = counts.a + counts.b;
          const pctA = total ? Math.round(counts.a / total * 100) : 50;
          const pctB = 100 - pctA;
          return (
            <article key={m.id} className={`group flex min-w-0 flex-col border border-rule bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-ink hover:shadow-[0_8px_24px_rgba(20,22,43,0.09)] ${compact ? 'flex-row sm:flex-col' : ''}`}>
              <Link href={`/matchup/${m.slug}`} aria-label={`Vote: ${m.nameA} versus ${m.nameB}`} className={compact ? 'grid min-w-0 flex-1 grid-cols-[112px_minmax(0,1fr)] sm:block' : 'block'}>
                <div className={`relative grid grid-cols-2 gap-px overflow-hidden bg-ink ${compact ? 'h-full min-h-[116px] sm:h-auto sm:min-h-0' : 'aspect-[1.65/1]'}`}>
                  <div className="relative min-w-0 overflow-hidden bg-[#17192d]">
                    <EntityImage src={m.imageA} name={m.nameA} fit="cover" className="h-full min-h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent px-2 pb-2 pt-8 sm:px-3 sm:pb-3">
                      <p className="line-clamp-2 text-xs font-black leading-tight text-white sm:text-sm">{m.nameA}</p>
                    </div>
                    <span className="absolute left-2 top-2 border border-white/30 bg-sidea px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">A</span>
                  </div>
                  <div className="relative min-w-0 overflow-hidden bg-[#272032]">
                    <EntityImage src={m.imageB} name={m.nameB} fit="cover" className="h-full min-h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent px-2 pb-2 pt-8 text-right sm:px-3 sm:pb-3">
                      <p className="line-clamp-2 text-xs font-black leading-tight text-white sm:text-sm">{m.nameB}</p>
                    </div>
                    <span className="absolute right-2 top-2 border border-white/30 bg-sideb px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">B</span>
                  </div>
                  <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center border-2 border-white bg-ink text-[10px] font-black uppercase tracking-wider text-white shadow-lg">VS</span>
                </div>
                <div className={compact ? 'min-w-0 p-3 sm:p-4' : 'p-4 sm:p-5'}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-sidea">Matchup {String(index + 1).padStart(2, '0')}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-mute">{round ? `Round ${round.roundNumber}` : 'Just added'}</span>
                  </div>
                  {!compact && (
                    <div className="grid grid-cols-2 gap-3 border-t border-rule pt-3">
                      <p className="line-clamp-3 text-xs leading-relaxed text-mute">{m.descriptionA}</p>
                      <p className="line-clamp-3 text-right text-xs leading-relaxed text-mute">{m.descriptionB}</p>
                    </div>
                  )}
                </div>
              </Link>
              <div className={`mt-auto border-t border-rule ${compact ? 'min-w-0 p-3' : 'px-4 pb-3 pt-3 sm:px-5'}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-sidea">{pctA}% <span className="font-semibold text-mute">· {counts.a}</span></span>
                  <span className="text-[10px] font-semibold text-mute">{total.toLocaleString()} votes</span>
                  <span className="text-xs font-extrabold text-sideb">{pctB}% <span className="font-semibold text-mute">· {counts.b}</span></span>
                </div>
                <div className="flex h-1.5 overflow-hidden bg-[#f7dce4]">
                  <span className="bg-sidea transition-[width]" style={{ width: `${pctA}%` }} />
                  <span className="bg-sideb transition-[width]" style={{ width: `${pctB}%` }} />
                </div>
                <Link href={`/matchup/${m.slug}`} className="mt-2 flex min-h-10 items-center justify-between text-sm font-extrabold text-ink transition-colors group-hover:text-sidea">
                  Vote in this matchup <span aria-hidden="true" className="text-lg">↗</span>
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
