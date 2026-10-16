import Link from 'next/link';
import { getActiveRound, getRoundCounts, listMatchups, type Matchup } from '@/lib/matchups';
import MatchupCreator from './MatchupCreator';
import EntityImage from './EntityImage';
import FeaturedMatchupCarousel from './FeaturedMatchupCarousel';

async function cardData(matchup: Matchup) {
  let round;
  try {
    round = await getActiveRound(matchup.id);
  } catch {
    return { round: null, counts: { a: 0, b: 0 } };
  }
  try {
    const counts = await getRoundCounts(round.id);
    return { round, counts };
  } catch {
    return { round, counts: { a: 0, b: 0 } };
  }
}

export default async function MatchupHome({ limit = 3 }: { limit?: number }) {
  const isDirectory = limit > 3;
  const matchups = await listMatchups(10000, !isDirectory);
  const data = await Promise.all(matchups.map(cardData));
  const ranked = matchups
    .map((matchup, index) => ({ matchup, ...data[index] }))

    .sort((left, right) => {
      if (isDirectory) return right.matchup.createdAt.localeCompare(left.matchup.createdAt);
      return (right.counts.a + right.counts.b) - (left.counts.a + left.counts.b) || right.matchup.createdAt.localeCompare(left.matchup.createdAt);
    })
    .slice(0, 10000);

  const heroPicks = ranked.filter(({ matchup }) => matchup.isFeatured);
  const heroItems = (heroPicks.length ? heroPicks : ranked).slice(0, heroPicks.length ? 12 : 3);

  return (
    <section id="matchups" className="matchup-board mt-12 scroll-mt-5 border-t border-rule pt-8 sm:mt-16 sm:pt-10">
      {!isDirectory && heroItems.length > 0 && (
        <FeaturedMatchupCarousel matchups={heroItems.map(({ matchup: m, round, counts }) => ({
          id: m.id, slug: m.slug, nameA: m.nameA, nameB: m.nameB,
          descriptionA: m.descriptionA, descriptionB: m.descriptionB,
          imageA: m.imageA, imageB: m.imageB,
          roundNumber: round?.roundNumber ?? null, votesA: counts.a, votesB: counts.b,
        }))} />
      )}
      {isDirectory ? (
        <div className="mb-5 flex flex-col gap-4 border-b border-rule pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-sidea">Explore Duelio</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">All matchups</h2><p className="mt-2 text-mute">Every published matchup, in one place.</p></div>
          <span className="text-sm font-bold text-mute">{ranked.length} matchups</span>
        </div>
      ) : (
        <>
          <MatchupCreator />
          <div className="mb-5 flex items-end justify-between border-b border-rule pb-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-sidea">Duelio picks</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Featured matchups</h2></div><Link href="/matchups" className="font-bold underline decoration-2 underline-offset-4 hover:text-sidea">All matchups →</Link></div>
        </>
      )}

      {ranked.length ? (
        true ? (
          <div className="mt-6 grid items-stretch gap-4 md:grid-cols-2">
            {ranked.map(({ matchup: m, round, counts }) => {
              const total = counts.a + counts.b;
              const pctA = total ? Math.round(counts.a / total * 100) : 50;
              const pctB = 100 - pctA;
              return (
                <article key={m.id} className="matchup-card group flex h-full flex-col overflow-hidden border border-rule bg-white transition-colors hover:bg-[#f8f9ff]">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                    <div><EntityImage src={m.imageA} name={m.nameA} className="matchup-portrait matchup-portrait-a aspect-[4/3] h-auto w-full bg-[#11172a] object-cover" /><h3 className="matchup-name mt-3 line-clamp-2 px-3 text-base font-extrabold sm:text-lg">{m.nameA}</h3><p className="mt-1 line-clamp-2 px-3 pb-3 text-xs leading-relaxed text-mute">{m.descriptionA}</p></div>
                    <span className="mt-10 text-[10px] font-black uppercase tracking-wider text-mute">vs</span>
                    <div><EntityImage src={m.imageB} name={m.nameB} className="matchup-portrait matchup-portrait-b aspect-[4/3] h-auto w-full bg-[#fff0f4] object-cover" /><h3 className="matchup-name mt-3 line-clamp-2 px-3 text-right text-base font-extrabold sm:text-lg">{m.nameB}</h3><p className="mt-1 line-clamp-2 px-3 pb-3 text-right text-xs leading-relaxed text-mute">{m.descriptionB}</p></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-rule px-3 pt-3 text-sm font-bold">
                    <span className="text-sidea">{pctA}% · {counts.a}</span>
                    <span className="text-xs font-semibold text-mute">{round ? `Round ${round.roundNumber}` : 'Preparing round'} · {total} votes</span>
                    <span className="text-sideb">{pctB}% · {counts.b}</span>
                  </div>
                  <div className="mt-2 flex h-1.5 overflow-hidden bg-[#fff1f4]"><span className="bg-sidea" style={{ width: `${pctA}%` }} /><span className="bg-sideb" style={{ width: `${pctB}%` }} /></div>
                  <Link href={`/matchup/${m.slug}`} className="mt-3 flex min-h-11 items-center justify-between border-t border-rule px-3 py-3 text-sm font-extrabold text-ink transition-colors group-hover:bg-ink group-hover:text-white">View matchup <span className="ml-2" aria-hidden="true">→</span></Link>
                </article>
              );
            })}
          </div>
        ) : (
          ranked.length > 3 ? (
            <MatchupCarousel matchups={ranked.slice(3).map(({ matchup: m, round, counts }) => ({
              id: m.id, slug: m.slug, nameA: m.nameA, nameB: m.nameB,
              descriptionA: m.descriptionA, descriptionB: m.descriptionB,
              imageA: m.imageA, imageB: m.imageB,
              roundNumber: round?.roundNumber ?? null, votesA: counts.a, votesB: counts.b,
            }))} />
          ) : (
            <div className="mt-6 rounded-2xl border border-rule bg-white p-5 text-sm text-mute">
              Want another debate? <Link href="/matchups" className="font-extrabold text-ink underline underline-offset-4">Explore every matchup →</Link>
            </div>
          )
        )
      ) : (
        <div className="mt-5 border border-dashed border-rule bg-white p-6 text-mute">
          No published matchups are available right now. Check back shortly, or create a matchup below.
        </div>
      )}
    </section>
  );
}
