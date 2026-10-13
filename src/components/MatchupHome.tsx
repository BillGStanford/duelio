import Link from 'next/link';
import { getActiveRound, getRoundCounts, listMatchups, type Matchup } from '@/lib/matchups';
import MatchupCreator from './MatchupCreator';
import EntityImage from './EntityImage';

async function cardData(matchup: Matchup) {
  try {
    const round = await getActiveRound(matchup.id);
    const counts = await getRoundCounts(round.id);
    return { round, counts };
  } catch { return { round: null, counts: { a: 0, b: 0 } }; }
}
export default async function MatchupHome({ limit = 3 }: { limit?: number }) {
  // Do not gate rendering on a separate schema probe: it can fail even when
  // the matchup table is readable, which made the whole board disappear.
  const matchups = await listMatchups(100);
  const data = await Promise.all(matchups.map(cardData));
  const ranked = matchups
    .map((matchup, index) => ({ matchup, ...data[index] }))
    .filter((item) => item.round?.status === 'active')
    .sort((left, right) =>
      (right.counts.a + right.counts.b) - (left.counts.a + left.counts.b) ||
      right.matchup.createdAt.localeCompare(left.matchup.createdAt)
    )
    .slice(0, limit);
  return (
    <section id="matchups" className="mt-12 scroll-mt-5 border-t border-rule pt-10 sm:mt-16 sm:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-sidea">The matchup board</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">The matchups everyone has an opinion on.</h2>
          <p className="mt-2 max-w-2xl text-mute">Head-to-head showdowns. Cast a vote, make your case, and watch public opinion shift as each round unfolds.</p>
        </div>
        <Link href="/#matchups" className="font-bold underline decoration-2 underline-offset-4 hover:text-sidea">Explore matchups</Link>
      </div>
      {ranked.length ? (
        <div className="mt-6 grid items-stretch gap-4 md:grid-cols-2">
          {ranked.map(({ matchup: m, round, counts }) => {
            const total = counts.a + counts.b;
            const pctA = total ? Math.round(counts.a / total * 100) : 50;
            const pctB = 100 - pctA;
            return (
              <article key={m.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-rule bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
                <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                  <div><EntityImage src={m.imageA} name={m.nameA} className="aspect-[4/3] h-auto w-full rounded-xl border border-rule bg-[#11172a] object-cover sm:aspect-[5/4]" /><h3 className="mt-2 line-clamp-2 font-extrabold">{m.nameA}</h3><p className="mt-1 line-clamp-2 text-xs text-mute">{m.descriptionA}</p></div>
                  <span className="mt-12 text-xs font-black uppercase text-mute">vs</span>
                  <div><EntityImage src={m.imageB} name={m.nameB} className="aspect-[4/3] h-auto w-full rounded-xl border border-rule bg-[#fff0f4] object-cover sm:aspect-[5/4]" /><h3 className="mt-2 line-clamp-2 text-right font-extrabold">{m.nameB}</h3><p className="mt-1 line-clamp-2 text-right text-xs text-mute">{m.descriptionB}</p></div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 text-sm font-bold">
                  <span className="text-sidea">{pctA}% · {counts.a}</span>
                  <span className="text-xs font-semibold text-mute">{round ? `Round ${round.roundNumber}` : 'Preparing round'} · {total} votes</span>
                  <span className="text-sideb">{pctB}% · {counts.b}</span>
                </div>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#fff1f4]"><span className="bg-sidea transition-all" style={{ width: `${pctA}%` }} /><span className="bg-sideb transition-all" style={{ width: `${pctB}%` }} /></div>
                <Link href={`/matchup/${m.slug}`} className="mt-auto mt-4 flex min-h-12 items-center justify-center rounded-xl bg-ink px-4 py-3 text-center font-extrabold text-white hover:bg-sidea">Vote and make your case <span className="ml-2" aria-hidden="true">→</span></Link>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-rule bg-white p-6 text-mute">
          No open matchups are available right now. Check back shortly, or create a matchup below.
        </div>
      )}
      <MatchupCreator />
    </section>
  );
}
