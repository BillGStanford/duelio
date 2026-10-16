import { getActiveRound, getRoundCounts, listMatchups, type Matchup } from '@/lib/matchups';
import MatchupDirectoryGrid from './MatchupDirectoryGrid';
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
  const matchups = await listMatchups(Number.MAX_SAFE_INTEGER, !isDirectory);
  const data = await Promise.all(matchups.map(cardData));
  const ranked = matchups
    .map((matchup, index) => ({ matchup, ...data[index] }))

    .sort((left, right) => {
      if (isDirectory) return right.matchup.createdAt.localeCompare(left.matchup.createdAt);
      return (right.counts.a + right.counts.b) - (left.counts.a + left.counts.b) || right.matchup.createdAt.localeCompare(left.matchup.createdAt);
    })
;

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
      ) : null}

      {isDirectory && ranked.length ? (
        <div className="mt-6">
          <MatchupDirectoryGrid matchups={ranked.map(({ matchup, round, counts }) => ({
            matchup: {
              id: matchup.id, slug: matchup.slug, nameA: matchup.nameA, nameB: matchup.nameB,
              descriptionA: matchup.descriptionA, descriptionB: matchup.descriptionB,
              imageA: matchup.imageA, imageB: matchup.imageB,
            },
            round: round ? { roundNumber: round.roundNumber } : null,
            counts,
          }))} />
        </div>
      ) : isDirectory ? (
        <div className="mt-5 border border-dashed border-rule bg-white p-6 text-mute">
          No published matchups are available right now. Create the first matchup to get things started.
        </div>
      ) : null}
    </section>
  );
}
