import Image from 'next/image';
import Link from 'next/link';
import DuelStrip from '@/components/DuelStrip';
import { dailyCloseAt, effectiveCloseAt, previousUtcDate, utcDateKey } from '@/lib/daily';
import { computeResults, isClosed, isDeadHeat, verdictLine } from '@/lib/results';
import { countWord, formatCloseDate } from '@/lib/site';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const store = getStore();
  const today = utcDateKey();
  const yesterday = previousUtcDate(today);
  const [dilemmas, yesterdayAssignment, todayAssignment] = await Promise.all([
    store.listDilemmas({ status: 'published' }),
    store.getDailyDilemma(yesterday),
    store.getDailyDilemma(today),
  ]);
  const [counts, dailyCloses] = await Promise.all([
    store.getCounts(dilemmas.map((d) => d.id)),
    Promise.all(dilemmas.map(async (d) => [d.id, await store.getLatestDailyClose(d.id)] as const)),
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
  const daily = todayAssignment?.dilemma;
  const dailyClosesAt = daily
    ? effectiveCloseAt(daily.closesAt, todayAssignment?.closesAt ?? dailyCloseAt(today))
    : null;
  const n = dilemmas.length;

  return (
    <main className="mx-auto max-w-5xl px-5">
      <section aria-labelledby="home-heading" className="grid gap-8 py-10 sm:py-14 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-sidea">Everyday questions. Two sides. Your call.</p>
          <h1 id="home-heading" className="mt-3 max-w-4xl text-4xl font-extrabold leading-tight tracking-[-0.035em] sm:text-6xl">
            The internet disagrees with you.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed sm:text-xl">
            Pick a side on a small everyday dilemma, see how others voted, and join the conversation. No account needed.
          </p>
        </div>
        <nav aria-label="Explore Duelio" className="flex flex-wrap gap-3 md:justify-end">
          <a href="#daily-duel" className="inline-flex min-h-12 items-center justify-center bg-ink px-5 py-3 text-base font-bold text-white hover:bg-sidea">
            Today&apos;s dilemma
          </a>
          <a href="#debates" className="inline-flex min-h-12 items-center justify-center border-2 border-ink px-5 py-3 text-base font-bold hover:bg-white">
            Browse dilemmas
          </a>
        </nav>
      </section>

      {daily && dailyClosesAt && (
        <section id="daily-duel" aria-labelledby="daily-heading" className="scroll-mt-4 border-y-4 border-ink bg-white px-5 py-7 sm:px-8 sm:py-9">
          <div className="grid items-center gap-7 md:grid-cols-[1fr_0.55fr]">
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
              <Link href={`/d/${daily.slug}`} className="mt-6 inline-flex min-h-12 items-center justify-center bg-ink px-6 py-3 text-lg font-bold text-white hover:bg-sidea">
                Read the dilemma and vote
              </Link>
            </div>
            <Image
              src="/daily-duel.svg"
              alt=""
              width={1200}
              height={720}
              priority
              aria-hidden="true"
              className="mx-auto h-auto w-full max-w-sm"
            />
          </div>
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
          Browse all {countWord(n).toLowerCase()} {n === 1 ? 'dilemma' : 'dilemmas'}. Choose one to vote and read the discussion.
        </p>
        {pinnedDeadHeat && (
          <div className="mt-5 border-l-8 border-sideb bg-white p-5 sm:p-6">
            <p className="text-sm font-extrabold uppercase tracking-[0.12em]">Close vote · at least 10 votes, split 45–55%</p>
            <Link href={`/d/${pinnedDeadHeat.slug}`} className="mt-2 block text-2xl font-extrabold tracking-tight underline decoration-2 underline-offset-4">
              {pinnedDeadHeat.question}
            </Link>
            <p className="mt-2 text-mute">
              {computeResults(counts[pinnedDeadHeat.id] ?? { a: 0, b: 0 }).pctA}% chose {pinnedDeadHeat.sideALabel}
              {' · '}
              {computeResults(counts[pinnedDeadHeat.id] ?? { a: 0, b: 0 }).pctB}% chose {pinnedDeadHeat.sideBLabel}
            </p>
          </div>
        )}
        <div className="mt-6 border-b-4 border-ink">
          {n === 0 ? (
            <div className="border-t-4 border-ink py-8">
              <p className="text-lg">There are no published dilemmas yet. Check back soon or submit one below.</p>
            </div>
          ) : (
            dilemmas.map((d) => {
              const c = counts[d.id] ?? { a: 0, b: 0 };
              const scheduledClose = effectiveCloseAt(d.closesAt, dailyCloseById.get(d.id) ?? null);
              return (
                <DuelStrip
                  key={d.id}
                  d={d}
                  total={c.a + c.b}
                  closed={isClosed({ closesAt: scheduledClose })}
                  deadHeat={isDeadHeat(c)}
                />
              );
            })
          )}
        </div>
      </section>

      <section aria-labelledby="submit-heading" className="mt-12 border-t-4 border-ink py-8">
        <h2 id="submit-heading" className="text-2xl font-extrabold tracking-tight">Have a dilemma of your own?</h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-mute">Send it to the editors for review. Approved questions may be published for everyone to vote on.</p>
        <Link href="/submit" className="mt-4 inline-flex min-h-12 items-center border-2 border-ink px-5 py-3 font-bold hover:bg-white">Submit a dilemma</Link>
      </section>
    </main>
  );
}
