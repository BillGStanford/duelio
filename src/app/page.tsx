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
      <section className="pb-10 pt-8 sm:pb-14 sm:pt-14">
        <h1 className="max-w-4xl text-[2.9rem] font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-7xl">
          The internet disagrees with you.
        </h1>
        <p className="mt-6 max-w-xl text-xl leading-snug">
          Turn the argument your group chat can&apos;t settle into a question everyone can answer.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#daily-duel" className="bg-ink px-6 py-3 text-lg font-bold text-white hover:bg-sidea">Pick today&apos;s side</a>
          <Link href="/submit" className="border-2 border-ink px-6 py-3 text-lg font-bold hover:bg-white">Submit a dilemma</Link>
        </div>
      </section>

      {daily && dailyClosesAt && (
        <section id="daily-duel" aria-labelledby="daily-heading" className="border-y-4 border-ink py-8 sm:py-10">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_0.8fr]">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-sidea">Duel of the day · {today} UTC</p>
              <h2 id="daily-heading" className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                {daily.question}
              </h2>
              {daily.context && <p className="mt-3 max-w-2xl text-lg leading-relaxed text-mute">{daily.context}</p>}
              <p className="mt-4 text-sm font-semibold text-mute">Voting closes {formatCloseDate(dailyClosesAt)}.</p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <div className="bg-sidea p-4 text-white">
                  <p className="font-extrabold">A · {daily.sideALabel}</p>
                  <p className="mt-1 text-sm">{daily.sideADescription}</p>
                </div>
                <div className="bg-sideb p-4 text-white">
                  <p className="font-extrabold">B · {daily.sideBLabel}</p>
                  <p className="mt-1 text-sm">{daily.sideBDescription}</p>
                </div>
              </div>
              <Link href={`/d/${daily.slug}`} className="mt-5 inline-block bg-ink px-6 py-3 text-lg font-bold text-white hover:bg-sidea">
                Vote and see the reveal tomorrow
              </Link>
            </div>
            <Image
              src="/daily-duel.svg"
              alt="Two colorful sides facing off in today’s duel"
              width={1200}
              height={720}
              priority
              className="h-auto w-full"
            />
          </div>
        </section>
      )}

      {yesterdayDilemma && yesterdayCounts && (
        <section aria-labelledby="yesterday-heading" className="mt-8 bg-ink p-5 text-white sm:p-7">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-rule">Yesterday&apos;s reveal · {yesterday}</p>
          <h2 id="yesterday-heading" className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {yesterdayDilemma.question}
          </h2>
          <p className="mt-2 text-lg">
            {verdictLine(computeResults(yesterdayCounts), yesterdayDilemma)}{' '}
            {computeResults(yesterdayCounts).total > 0
              ? `${computeResults(yesterdayCounts).pctA}% chose ${yesterdayDilemma.sideALabel}; ${computeResults(yesterdayCounts).pctB}% chose ${yesterdayDilemma.sideBLabel}.`
              : 'There were no votes before the close.'}
          </p>
          <Link href={`/d/${yesterdayDilemma.slug}`} className="mt-4 inline-block font-bold underline decoration-2 underline-offset-4 hover:text-rule">
            See the final result
          </Link>
        </section>
      )}

      <section id="debates" aria-labelledby="debates-heading" className="mt-10 scroll-mt-4">
        <h2 id="debates-heading" className="text-3xl font-extrabold tracking-tight">More arguments worth settling</h2>
        <p className="mt-1 text-lg text-mute">
          {n === 7 ? 'Seven questions. Two sides. No pretending everyone agrees.' : `${countWord(n)} ${n === 1 ? 'question' : 'questions'}. Two sides. No pretending everyone agrees.`}
        </p>
        {pinnedDeadHeat && (
          <div className="mt-5 border-l-8 border-sideb bg-white p-5 sm:p-6">
            <p className="text-sm font-extrabold uppercase tracking-[0.12em]">Pinned dead heat · at least 10 votes, split 45–55%</p>
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
        <div className="mt-6">
          {n === 0 ? (
            <div className="border-t-4 border-ink py-8">
              <p className="text-2xl font-bold">Got an argument your group chat can&apos;t settle?</p>
              <Link href="/submit" className="mt-4 inline-block bg-ink px-5 py-3 font-bold text-white hover:bg-sidea">Submit a dilemma</Link>
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

      <section className="mt-6 border-t-4 border-ink py-10">
        <p className="text-2xl font-extrabold tracking-tight">Got an argument your group chat can&apos;t settle?</p>
        <Link href="/submit" className="mt-4 inline-block border-2 border-ink px-5 py-3 font-bold hover:bg-white">Submit a dilemma</Link>
      </section>
    </main>
  );
}
