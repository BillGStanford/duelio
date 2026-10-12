import Link from 'next/link';
import { getActiveRound, getRoundCounts, isMatchupSchemaReady, listMatchups, type Matchup } from '@/lib/matchups';
import MatchupCreator from './MatchupCreator';
import EntityImage from './EntityImage';

async function cardData(matchup: Matchup) {
  try {
    const round = await getActiveRound(matchup.id);
    const counts = await getRoundCounts(round.id);
    return { round, counts };
  } catch { return { round: null, counts: { a: 0, b: 0 } }; }
}
export default async function MatchupHome() {
  if (!(await isMatchupSchemaReady())) return null;
  const matchups = await listMatchups(8);
  const data = await Promise.all(matchups.map(cardData));
  return (
    <section id="matchups" className="mt-10 scroll-mt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-sidea">The matchup board</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Settle the biggest debates.</h2>
          <p className="mt-2 max-w-2xl text-mute">Public opinion, live vote splits, two-week rounds, and a permanent record of every champion.</p>
        </div>
        <Link href="/#matchups" className="font-bold underline decoration-2 underline-offset-4 hover:text-sidea">Explore matchups</Link>
      </div>
      {matchups.length ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {matchups.map((m, i) => {
            const { round, counts } = data[i];
            const total = counts.a + counts.b;
            const pctA = total ? Math.round(counts.a / total * 100) : 50;
            const pctB = 100 - pctA;
            return (
              <article key={m.id} className="overflow-hidden rounded-2xl border border-rule bg-white p-4 shadow-sm sm:p-5">
                <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                  <div><EntityImage src={m.imageA} name={m.nameA} className="h-28 w-full rounded-xl border border-rule bg-paper p-1 sm:h-36" /><h3 className="mt-2 line-clamp-2 font-extrabold">{m.nameA}</h3><p className="mt-1 line-clamp-2 text-xs text-mute">{m.descriptionA}</p></div>
                  <span className="mt-12 text-xs font-black uppercase text-mute">vs</span>
                  <div><EntityImage src={m.imageB} name={m.nameB} className="h-28 w-full rounded-xl border border-rule bg-paper p-1 sm:h-36" /><h3 className="mt-2 line-clamp-2 text-right font-extrabold">{m.nameB}</h3><p className="mt-1 line-clamp-2 text-right text-xs text-mute">{m.descriptionB}</p></div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 text-sm font-bold">
                  <span className="text-sidea">{pctA}% · {counts.a}</span>
                  <span className="text-xs font-semibold text-mute">{round ? `Round ${round.roundNumber}` : 'Preparing round'} · {total} votes</span>
                  <span className="text-sideb">{pctB}% · {counts.b}</span>
                </div>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#fff1f4]"><span className="bg-sidea transition-all" style={{ width: `${pctA}%` }} /><span className="bg-sideb transition-all" style={{ width: `${pctB}%` }} /></div>
                <Link href={`/matchup/${m.slug}`} className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-ink px-4 py-3 text-center font-extrabold text-white hover:bg-sidea">Vote and make your case <span className="ml-2" aria-hidden="true">→</span></Link>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-rule bg-white p-6 text-mute">
          No public matchups yet. Create the first one below—your matchup will get a permanent page.
        </div>
      )}
      <MatchupCreator />
    </section>
  );
}
