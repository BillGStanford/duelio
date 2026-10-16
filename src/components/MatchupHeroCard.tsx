import Link from 'next/link';
import EntityImage from './EntityImage';

export interface FeaturedMatchup {
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

export default function MatchupHeroCard({ matchup, index, total }: {
  matchup: FeaturedMatchup;
  index: number;
  total: number;
}) {
  const votes = matchup.votesA + matchup.votesB;

  return (
    <article className="relative isolate flex min-h-[410px] w-full flex-col overflow-hidden rounded-[28px] bg-[#101629] text-white shadow-[0_24px_70px_rgba(20,29,61,0.20)] sm:min-h-[450px]">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_25%,rgba(78,92,240,0.40),transparent_48%),radial-gradient(ellipse_at_80%_25%,rgba(231,93,135,0.34),transparent_48%),linear-gradient(135deg,#111a34,#10121e_55%,#1a1423)]" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.16)_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-8 sm:pt-7">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.17em] text-white/80">
          <span className="h-1.5 w-1.5 rounded-full bg-[#9da7ff] shadow-[0_0_12px_#9da7ff]" />
          Featured matchup
        </span>
        <span className="text-xs font-semibold tabular-nums text-white/55">{String(index + 1).padStart(2, '0')} <span className="text-white/30">/ {String(total).padStart(2, '0')}</span></span>
      </div>

      <div className="relative mt-5 grid flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2 px-3 sm:mt-7 sm:gap-4 sm:px-7">
        <div className="relative flex min-w-0 flex-col items-center overflow-hidden rounded-2xl border border-[#8b96ff]/25 bg-gradient-to-b from-[#5362ee]/20 to-[#11172b]/70 px-2 pt-3 sm:px-5 sm:pt-5">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#8792ff] to-transparent" />
          <div className="relative flex h-[clamp(115px,23vw,205px)] w-full items-center justify-center">
            <div aria-hidden="true" className="absolute h-[88%] w-[88%] rounded-full bg-[#6674ff]/20 blur-2xl" />
            <EntityImage src={matchup.imageA} name={matchup.nameA} className="relative z-10 h-full w-full object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,.38)]" />
          </div>
          <span className="mt-2 rounded-full bg-[#6674ff]/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.17em] text-[#c4caff] sm:text-[10px]">Side A</span>
          <h3 className="mt-3 line-clamp-2 w-full text-center text-lg font-black leading-tight tracking-[-0.035em] sm:text-2xl">{matchup.nameA}</h3>
          <p className="mb-4 mt-2 line-clamp-2 max-w-[24ch] text-center text-[11px] leading-relaxed text-white/60 sm:text-sm">{matchup.descriptionA || 'Make the case for this contender.'}</p>
        </div>

        <div className="relative z-20 flex items-center justify-center">
          <span className="grid h-10 w-10 rotate-[-8deg] place-items-center rounded-xl border border-white/20 bg-[#f6f7fb] text-xs font-black italic text-[#172033] shadow-[0_8px_28px_rgba(0,0,0,.25)] sm:h-12 sm:w-12 sm:text-sm">VS</span>
        </div>

        <div className="relative flex min-w-0 flex-col items-center overflow-hidden rounded-2xl border border-[#ff8aa9]/25 bg-gradient-to-b from-[#e75d87]/20 to-[#211521]/70 px-2 pt-3 sm:px-5 sm:pt-5">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#ff8bad] to-transparent" />
          <div className="relative flex h-[clamp(115px,23vw,205px)] w-full items-center justify-center">
            <div aria-hidden="true" className="absolute h-[88%] w-[88%] rounded-full bg-[#e75d87]/20 blur-2xl" />
            <EntityImage src={matchup.imageB} name={matchup.nameB} className="relative z-10 h-full w-full object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,.38)]" />
          </div>
          <span className="mt-2 rounded-full bg-[#e75d87]/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.17em] text-[#ffc2d2] sm:text-[10px]">Side B</span>
          <h3 className="mt-3 line-clamp-2 w-full text-center text-lg font-black leading-tight tracking-[-0.035em] sm:text-2xl">{matchup.nameB}</h3>
          <p className="mb-4 mt-2 line-clamp-2 max-w-[24ch] text-center text-[11px] leading-relaxed text-white/60 sm:text-sm">{matchup.descriptionB || 'Make the case for this contender.'}</p>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 sm:px-8 sm:py-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.17em] text-white/45">{matchup.roundNumber ? `Round ${matchup.roundNumber}` : 'Community matchup'} <span className="mx-1.5 text-white/20">·</span> {votes.toLocaleString()} {votes === 1 ? 'vote' : 'votes'}</p>
          <p className="mt-1 text-sm font-extrabold sm:text-base">The crowd decides. Which side are you on?</p>
        </div>
        <Link href={`/matchup/${matchup.slug}`} className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-white px-5 py-3 text-sm font-black text-[#172033] transition-colors hover:bg-[#dfe3ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto">
          Cast your vote <span aria-hidden="true" className="text-lg">→</span>
        </Link>
      </div>
    </article>
  );
}
