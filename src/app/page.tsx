import Image from 'next/image';
import Link from 'next/link';
import DuelStrip from '@/components/DuelStrip';
import MatchupHome from '@/components/MatchupHome';
import { dailyCloseAt, effectiveCloseAt, previousUtcDate, utcDateKey } from '@/lib/daily';
import { computeResults, isClosed, isDeadHeat, isHot, verdictLine } from '@/lib/results';
import { countWord, formatCloseDate } from '@/lib/site';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams?: { q?: string | string[] } }) {
  const store = getStore();
  const today = utcDateKey();
  const yesterday = previousUtcDate(today);
  const [dilemmas, yesterdayAssignment, todayAssignment] = await Promise.all([
    store.listDilemmas({ status: 'published' }),
    store.getDailyDilemma(yesterday),
    store.getDailyDilemma(today),
  ]);
  const daily = todayAssignment?.dilemma;
  const [counts, dailyCloses, namedVotes] = await Promise.all([
    store.getCounts(dilemmas.map((d) => d.id)),
    Promise.all(dilemmas.map(async (d) => [d.id, await store.getLatestDailyClose(d.id)] as const)),
    daily ? store.getNamedVotes(daily.id) : Promise.resolve([]),
  ]);
  const dailyCloseById = new Map(dailyCloses);
  const deadHeats = dilemmas
    .filter((d) => isDeadHeat(counts[d.id] ?? { a: 0, b: 0 }))
    .sort((a, b) => {
      const ca = counts[a.id] ?? { a: 0, b: 0 };
      const cb = counts[b.id] ?? { a: 0, b: 0 };
      return Math.abs(ca.a - ca.b) - Math.abs(cb.a - cb.b) || (cb.a + cb.b) - (ca.a + ca.b);
    });
  const pinnedDeadHeat = deadHeats[0] ?? null;
  const yesterdayDilemma = yesterdayAssignment?.dilemma;
  const yesterdayCounts = yesterdayDilemma ? counts[yesterdayDilemma.id] ?? { a: 0, b: 0 } : null;
  const dailyClosesAt = daily
    ? effectiveCloseAt(daily.closesAt, todayAssignment?.closesAt ?? dailyCloseAt(today))
    : null;
  const rawQuery = searchParams?.q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim().slice(0, 100) ?? '';
  const normalizedQuery = query.toLocaleLowerCase();
  const matchingDilemmas = dilemmas
    .filter((d) => {
      if (!normalizedQuery) return true;
      return [
        d.question,
        d.context,
        d.sideALabel,
        d.sideADescription,
        d.sideBLabel,
        d.sideBDescription,
        d.submittedBy ?? '',
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    })
    .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));
  const pinnedHot = matchingDilemmas
    .filter((d) => isHot(counts[d.id] ?? { a: 0, b: 0 }))
    .filter((d) => d.id !== pinnedDeadHeat?.id)
    .sort((a, b) => {
      const ca = counts[a.id] ?? { a: 0, b: 0 };
      const cb = counts[b.id] ?? { a: 0, b: 0 };
      return cb.a + cb.b - ca.a - ca.b;
    })
    .slice(0, 3);
  const n = dilemmas.length;

  return (
    <main className="mx-auto max-w-5xl px-5">
      <section aria-labelledby="home-heading" className="grid gap-8 py-10 sm:py-14 md:grid-cols-[1fr_0.8fr] md:items-center">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-sidea">POLLS · MATCHUPS · PUBLIC OPINION</p>
          <h1 id="home-heading" className="mt-3 max-w-4xl text-4xl font-extrabold leading-tight tracking-[-0.035em] sm:text-6xl">
            Every debate deserves a verdict.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed sm:text-xl">
            Vote on everyday dilemmas or create a matchup between any two people, ideas, teams, or things. See public opinion shift live, make your case, and share the debate. No account or money needed.
          </p>
        </div>
        <div className="grid justify-items-center gap-3">
          <Image
            src="/daily-duel.svg"
            alt=""
            width={1200}
            height={720}
            priority
            aria-hidden="true"
            className="h-auto w-full max-w-sm"
          />
          <nav aria-label="Explore Duelio" className="grid w-full gap-2 sm:grid-cols-2">
            <a href="/polls#daily-duel" className="inline-flex min-h-12 items-center justify-center bg-ink px-5 py-3 text-base font-bold text-white hover:bg-sidea">
              Daily polls
            </a>
            <a href="/polls" className="inline-flex min-h-12 items-center justify-center border-2 border-ink px-5 py-3 text-base font-bold hover:bg-white">
              All polls
            </a>
          </nav>
        </div>
      </section>

      <MatchupHome />

      {daily && dailyClosesAt && (
        <section id="daily-duel" aria-labelledby="daily-heading" className="scroll-mt-4 border-t-4 border-ink bg-white px-5 py-7 sm:px-8 sm:py-9">
          <div className="grid gap-8 md:grid-cols-[1.55fr_0.75fr]">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-sidea">Today&apos;s dilemma · {today} UTC</p>
              <h2 id="daily-heading" className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                {daily.question}
              </h2>
              {daily.context && <p className="mt-3 max-w-2xl text-lg leading-relaxed">{daily.context}</p>}
              <p className="mt-4 text-sm font-semibold text-mute">
                Voting closes {formatCloseDate(dailyClosesAt)}. Vote to see the current split; the final result is available after closing.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="border-l-4 border-sidea bg-[#f2f3ff] p-4">
                  <h3 className="font-extrabold">Side A: {daily.sideALabel}</h3>
                  <p className="mt-1 leading-relaxed">{daily.sideADescription}</p>
                </div>
                <div className="border-l-4 border-sideb bg-[#fff1f4] p-4">
                  <h3 className="font-extrabold">Side B: {daily.sideBLabel}</h3>
                  <p className="mt-1 leading-relaxed">{daily.sideBDescription}</p>
                </div>
              </div>
              <div className="mt-6 -mx-5 flex flex-wrap items-center justify-between gap-3 bg-ink px-5 py-4 text-white sm:-mx-8 sm:px-8">
                <p className="text-sm font-semibold">Vote to see the current split. Final results show after closing.</p>
                <Link href={`/d/${daily.slug}`} className="inline-flex min-h-11 items-center justify-center bg-sidea px-5 py-2 font-bold text-white hover:bg-sideb">
                  Read the dilemma and vote
                </Link>
              </div>
            </div>
            <aside aria-labelledby="live-feed-heading" className="border-t-4 border-ink pt-4 md:border-l-4 md:border-t-0 md:pl-5">
              <h3 id="live-feed-heading" className="text-sm font-extrabold uppercase tracking-[0.12em]">Live vote feed</h3>
              <p className="mt-1 text-sm text-mute">On today&apos;s dilemma</p>
              {namedVotes.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {namedVotes.map((vote, index) => (
                    <li key={`${vote.name}-${index}`} className="flex items-baseline justify-between gap-2 border-b border-rule pb-2">
                      <span className="min-w-0 truncate font-bold">{vote.name}</span>
                      <span className={`shrink-0 text-sm font-extrabold ${vote.side === 'a' ? 'text-sidea' : 'text-sideb'}`}>
                        voted {vote.side === 'a' ? daily.sideALabel : daily.sideBLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 bg-[#f2f3ff] p-4 leading-relaxed">
                  No public names yet. Be the first to vote and choose whether to add a nickname.
                </p>
              )}
              <Link href={`/d/${daily.slug}`} className="mt-4 inline-flex min-h-11 items-center font-bold underline decoration-2 underline-offset-4">
                Join today&apos;s vote
              </Link>
            </aside>
          </div>
          <div className="border-b-4 border-ink" />
        </section>
      )}

      {yesterdayDilemma && yesterdayCounts && (
        <section aria-labelledby="yesterday-heading" className="mt-8 border-l-8 border-sidea bg-ink p-5 text-white sm:p-7">
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-rule">Yesterday&apos;s result · {yesterday} UTC</p>
          <h2 id="yesterday-heading" className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {yesterdayDilemma.question}
          </h2>
          <p className="mt-2 text-lg">
            {verdictLine(computeResults(yesterdayCounts), yesterdayDilemma)}{' '}
            {computeResults(yesterdayCounts).total > 0
              ? `${computeResults(yesterdayCounts).pctA}% chose ${yesterdayDilemma.sideALabel}; ${computeResults(yesterdayCounts).pctB}% chose ${yesterdayDilemma.sideBLabel}, from ${computeResults(yesterdayCounts).total} votes.`
              : 'There were no votes before the close.'}
          </p>
          <Link href={`/d/${yesterdayDilemma.slug}`} className="mt-4 inline-flex min-h-11 items-center font-bold underline decoration-2 underline-offset-4 hover:text-rule">
            View yesterday&apos;s dilemma and result
          </Link>
        </section>
      )}

      <section id="debates" aria-labelledby="debates-heading" className="mt-10 scroll-mt-4">
        <h2 id="debates-heading" className="text-3xl font-extrabold tracking-tight">Browse dilemmas</h2>
        <p className="mt-1 text-lg text-mute">
          All {countWord(n).toLowerCase()} {n === 1 ? 'dilemma' : 'dilemmas'} are listed below. Pinned picks are featured above, too.
        </p>
        <form method="get" action="/" role="search" className="mt-5 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="dilemma-search" className="sr-only">Search dilemmas</label>
          <input
            id="dilemma-search"
            name="q"
            type="search"
            maxLength={100}
            defaultValue={query}
            placeholder="Search questions, sides, or context"
            className="min-h-12 min-w-0 flex-1 border-2 border-ink bg-white px-4 py-2 text-base"
          />
          <button type="submit" className="min-h-12 bg-ink px-6 py-2 font-bold text-white hover:bg-sidea">Search</button>
          {query && <Link href="/#debates" className="inline-flex min-h-12 items-center justify-center border-2 border-ink px-4 py-2 font-bold hover:bg-white">Clear</Link>}
        </form>
        <p className="mt-3 text-sm font-semibold text-mute" aria-live="polite">
          {query
            ? `${matchingDilemmas.length} ${matchingDilemmas.length === 1 ? 'result' : 'results'} for “${query}”.`
            : `Showing all ${countWord(n).toLowerCase()} ${n === 1 ? 'dilemma' : 'dilemmas'}.`}
        </p>
        {(pinnedDeadHeat && matchingDilemmas.some((d) => d.id === pinnedDeadHeat.id) || pinnedHot.length > 0) && (
          <section aria-labelledby="pinned-heading" className="mt-6">
            <h3 id="pinned-heading" className="text-sm font-extrabold uppercase tracking-[0.12em]">Pinned for you</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {pinnedDeadHeat && matchingDilemmas.some((d) => d.id === pinnedDeadHeat.id) && (
                <article className="border-l-8 border-sideb bg-white p-5">
                  <p className="text-sm font-extrabold uppercase tracking-wide">Close vote · 10+ votes · 45–55% split</p>
                  <Link href={`/d/${pinnedDeadHeat.slug}`} className="mt-2 block text-xl font-extrabold tracking-tight underline decoration-2 underline-offset-4">
                    {pinnedDeadHeat.question}
                  </Link>
                  <p className="mt-2 text-sm text-mute">
                    {computeResults(counts[pinnedDeadHeat.id] ?? { a: 0, b: 0 }).pctA}% chose {pinnedDeadHeat.sideALabel}
                    {' · '}
                    {computeResults(counts[pinnedDeadHeat.id] ?? { a: 0, b: 0 }).pctB}% chose {pinnedDeadHeat.sideBLabel}
                  </p>
                </article>
              )}
              {pinnedHot.map((d) => {
                const r = computeResults(counts[d.id] ?? { a: 0, b: 0 });
                return (
                  <article key={d.id} className="border-l-8 border-sidea bg-white p-5">
                    <p className="text-sm font-extrabold uppercase tracking-wide text-sidea">Hot · {r.total} votes</p>
                    <Link href={`/d/${d.slug}`} className="mt-2 block text-xl font-extrabold tracking-tight underline decoration-2 underline-offset-4">
                      {d.question}
                    </Link>
                    <p className="mt-2 text-sm text-mute">{r.pctA}% chose {d.sideALabel} · {r.pctB}% chose {d.sideBLabel}</p>
                  </article>
                );
              })}
            </div>
          </section>
        )}
        <div className="mt-6 border-b-4 border-ink">
          {matchingDilemmas.length === 0 ? (
            <div className="border-t-4 border-ink py-8">
              <p className="text-lg">{query ? 'No dilemmas match that search. Try another phrase or submit your own.' : 'There are no published dilemmas yet. Check back soon or submit one below.'}</p>
            </div>
          ) : matchingDilemmas.length > 0 ? (
            matchingDilemmas.map((d) => {
              const c = counts[d.id] ?? { a: 0, b: 0 };
              const scheduledClose = effectiveCloseAt(d.closesAt, dailyCloseById.get(d.id) ?? null);
              return (
                <DuelStrip
                  key={d.id}
                  d={d}
                  total={c.a + c.b}
                  closed={isClosed({ closesAt: scheduledClose })}
                  deadHeat={isDeadHeat(c)}
                  hot={isHot(c)}
                />
              );
            })
          ) : null}
        </div>
      </section>

      <section aria-labelledby="submit-heading" className="mt-12 border-t-4 border-ink py-8">
        <h2 id="submit-heading" className="text-2xl font-extrabold tracking-tight">Have a dilemma of your own?</h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-mute">Share a low-stakes question. Once submitted, it goes live in the feed and is ready for everyone to vote on.</p>
        <Link href="/submit" className="mt-4 inline-flex min-h-12 items-center border-2 border-ink px-5 py-3 font-bold hover:bg-white">Submit a dilemma</Link>
      </section>
    </main>
  );
}
