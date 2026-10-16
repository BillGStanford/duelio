import Link from 'next/link';
import MatchupHome from '@/components/MatchupHome';
import DuelStrip from '@/components/DuelStrip';
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
  const yesterdayDilemma = yesterdayAssignment?.dilemma;
  const yesterdayCounts = yesterdayDilemma ? counts[yesterdayDilemma.id] ?? { a: 0, b: 0 } : null;
  const dailyClosesAt = daily
    ? effectiveCloseAt(daily.closesAt, todayAssignment?.closesAt ?? dailyCloseAt(today))
    : null;
  const rawQuery = searchParams?.q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim().slice(0, 100) ?? '';
  const normalizedQuery = query.toLocaleLowerCase();
  const matchingDilemmas = dilemmas
    .filter((d) => !normalizedQuery || [
      d.question, d.context, d.sideALabel, d.sideADescription,
      d.sideBLabel, d.sideBDescription, d.submittedBy ?? '',
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
    .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));
  const deadHeats = matchingDilemmas
    .filter((d) => isDeadHeat(counts[d.id] ?? { a: 0, b: 0 }))
    .sort((a, b) => {
      const ca = counts[a.id] ?? { a: 0, b: 0 };
      const cb = counts[b.id] ?? { a: 0, b: 0 };
      return Math.abs(ca.a - ca.b) - Math.abs(cb.a - cb.b) || (cb.a + cb.b) - (ca.a + ca.b);
    });
  const hot = matchingDilemmas
    .filter((d) => isHot(counts[d.id] ?? { a: 0, b: 0 }))
    .sort((a, b) => {
      const ca = counts[a.id] ?? { a: 0, b: 0 };
      const cb = counts[b.id] ?? { a: 0, b: 0 };
      return cb.a + cb.b - ca.a - ca.b;
    }).slice(0, 2);
  const pinnedDeadHeat = deadHeats[0] ?? null;
  const n = dilemmas.length;

  return (
    <main className="pb-16">
      <section className="relative overflow-hidden bg-ink text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full border-[48px] border-sidea/20" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 right-[18%] h-80 w-80 rounded-full border-[34px] border-sideb/20" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-white/80">
              <span className="h-2 w-2 rounded-full bg-sidea" /> The public opinion arena
            </div>
            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.055em] sm:text-7xl">
              Pick a side.<br /><span className="text-sidea">Move the crowd.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75 sm:text-xl">
              Head-to-head matchups and everyday dilemmas, decided by real votes. Make your call, defend it, and see where everyone else lands.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/matchups" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-sidea px-6 py-3 font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#4f5fdf]">Enter the matchup arena <span className="ml-2" aria-hidden="true">↗</span></Link>
              <Link href="/submit" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 px-6 py-3 font-extrabold text-white transition hover:bg-white/10">Start a debate</Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-sidea">01 / Choose</p>
              <h2 className="mt-2 text-xl font-extrabold">Two sides. Your call.</h2>
              <p className="mt-1 text-sm leading-relaxed text-white/65">Vote on competitors, ideas, and the questions your group chat can’t settle.</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-sideb">02 / Make your case</p>
              <h2 className="mt-2 text-xl font-extrabold">The crowd has a verdict.</h2>
              <p className="mt-1 text-sm leading-relaxed text-white/65">See the vote split, build your argument, and share the matchup with others.</p>
            </div>
          </div>
        </div>
        <div className="relative border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white/55">
            <span>Duelio · Public opinion, in motion</span><span>{n} published {n === 1 ? 'dilemma' : 'dilemmas'} · No account needed to vote</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <MatchupHome />

        {daily && dailyClosesAt && (
          <section id="daily-duel" aria-labelledby="daily-heading" className="mt-14 overflow-hidden rounded-3xl border border-rule bg-white shadow-sm">
            <div className="grid lg:grid-cols-[1fr_300px]">
              <div className="p-6 sm:p-9">
                <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-sidea">
                  <span className="rounded-full bg-[#eef0ff] px-3 py-1.5">Daily dilemma</span><span className="text-mute">{today} UTC</span>
                </div>
                <h2 id="daily-heading" className="mt-5 max-w-3xl text-3xl font-black leading-tight tracking-[-0.035em] sm:text-5xl">{daily.question}</h2>
                {daily.context && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-mute">{daily.context}</p>}
                <p className="mt-4 text-sm font-semibold text-mute">Voting closes {formatCloseDate(dailyClosesAt)}. The final result is available after closing.</p>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-sidea/15 bg-[#f2f3ff] p-5"><p className="text-xs font-black uppercase tracking-widest text-sidea">Side A</p><h3 className="mt-2 text-xl font-extrabold">{daily.sideALabel}</h3><p className="mt-2 leading-relaxed">{daily.sideADescription}</p></div>
                  <div className="rounded-2xl border border-sideb/15 bg-[#fff1f4] p-5"><p className="text-xs font-black uppercase tracking-widest text-sideb">Side B</p><h3 className="mt-2 text-xl font-extrabold">{daily.sideBLabel}</h3><p className="mt-2 leading-relaxed">{daily.sideBDescription}</p></div>
                </div>
                <Link href={`/d/${daily.slug}`} className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-ink px-5 py-3 font-extrabold text-white transition hover:bg-sidea">Read the dilemma and vote <span className="ml-2" aria-hidden="true">→</span></Link>
              </div>
              <aside className="border-t border-rule bg-[#f7f8fc] p-6 sm:p-8 lg:border-l lg:border-t-0">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-mute">Live vote feed</p><h3 className="mt-2 text-xl font-extrabold">The latest calls</h3>
                {namedVotes.length ? <ul className="mt-5 space-y-3">{namedVotes.slice(0, 8).map((vote, index) => <li key={`${vote.name}-${index}`} className="flex items-start justify-between gap-3 border-b border-rule pb-3"><span className="min-w-0 truncate text-sm font-bold">{vote.name}</span><span className={`shrink-0 text-right text-xs font-extrabold ${vote.side === 'a' ? 'text-sidea' : 'text-sideb'}`}>{vote.side === 'a' ? daily.sideALabel : daily.sideBLabel}</span></li>)}</ul> : <p className="mt-5 rounded-xl border border-rule bg-white p-4 text-sm leading-relaxed text-mute">No public names yet. Be the first to vote and choose whether to add a nickname.</p>}
                <Link href={`/d/${daily.slug}`} className="mt-5 inline-flex font-extrabold underline underline-offset-4">Join the vote →</Link>
              </aside>
            </div>
          </section>
        )}

        {yesterdayDilemma && yesterdayCounts && (
          <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-rule bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div><p className="text-xs font-black uppercase tracking-[0.13em] text-mute">Yesterday’s verdict · {yesterday} UTC</p><h2 className="mt-2 text-xl font-extrabold sm:text-2xl">{yesterdayDilemma.question}</h2><p className="mt-2 leading-relaxed text-mute">{verdictLine(computeResults(yesterdayCounts), yesterdayDilemma)} {computeResults(yesterdayCounts).total > 0 ? `${computeResults(yesterdayCounts).pctA}% chose ${yesterdayDilemma.sideALabel}; ${computeResults(yesterdayCounts).pctB}% chose ${yesterdayDilemma.sideBLabel} from ${computeResults(yesterdayCounts).total} votes.` : 'There were no votes before the close.'}</p></div>
            <Link href={`/d/${yesterdayDilemma.slug}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-rule px-4 py-2 font-extrabold hover:bg-paper">See the result →</Link>
          </section>
        )}

        <section id="debates" aria-labelledby="debates-heading" className="mt-16 scroll-mt-4">
          <div className="flex flex-col gap-5 border-b border-rule pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.15em] text-sidea">The dilemma desk</p><h2 id="debates-heading" className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">What side are you on?</h2><p className="mt-2 text-mute">Browse all {countWord(n).toLowerCase()} {n === 1 ? 'dilemma' : 'dilemmas'}, from close calls to the crowd’s hottest debates.</p></div>
            <Link href="/submit" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-4 py-2 font-extrabold text-white hover:bg-sidea">Submit a dilemma +</Link>
          </div>
          <form method="get" action="/" role="search" className="mt-5 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="dilemma-search" className="sr-only">Search dilemmas</label>
            <input id="dilemma-search" name="q" type="search" maxLength={100} defaultValue={query} placeholder="Search questions, sides, or context" className="min-h-12 min-w-0 flex-1 rounded-xl border border-rule bg-white px-4 py-3 text-base outline-none focus:border-sidea focus:ring-2 focus:ring-sidea/15"/>
            <button type="submit" className="min-h-12 rounded-xl bg-ink px-6 py-3 font-extrabold text-white hover:bg-sidea">Search debates</button>
            {query && <Link href="/#debates" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-rule px-4 py-2 font-bold hover:bg-white">Clear</Link>}
          </form>
          <p className="mt-3 text-sm font-semibold text-mute" aria-live="polite">{query ? `${matchingDilemmas.length} ${matchingDilemmas.length === 1 ? 'result' : 'results'} for “${query}”.` : `Showing all ${countWord(n).toLowerCase()} ${n === 1 ? 'dilemma' : 'dilemmas'}.`}</p>
          {(pinnedDeadHeat || hot.length > 0) && <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {pinnedDeadHeat && <article className="rounded-2xl border border-sideb/20 bg-white p-5"><p className="text-xs font-black uppercase tracking-widest text-sideb">Closest vote</p><Link href={`/d/${pinnedDeadHeat.slug}`} className="mt-2 block text-lg font-extrabold underline decoration-2 underline-offset-4">{pinnedDeadHeat.question}</Link><p className="mt-2 text-sm text-mute">{computeResults(counts[pinnedDeadHeat.id] ?? {a:0,b:0}).pctA}% chose {pinnedDeadHeat.sideALabel} · {computeResults(counts[pinnedDeadHeat.id] ?? {a:0,b:0}).pctB}% chose {pinnedDeadHeat.sideBLabel}</p></article>}
            {hot.map((d) => { const result = computeResults(counts[d.id] ?? {a:0,b:0}); return <article key={d.id} className="rounded-2xl border border-sidea/20 bg-white p-5"><p className="text-xs font-black uppercase tracking-widest text-sidea">Hot debate · {result.total} votes</p><Link href={`/d/${d.slug}`} className="mt-2 block text-lg font-extrabold underline decoration-2 underline-offset-4">{d.question}</Link><p className="mt-2 text-sm text-mute">{result.pctA}% chose {d.sideALabel} · {result.pctB}% chose {d.sideBLabel}</p></article>})}
          </div>}
          <div className="mt-6 overflow-hidden rounded-2xl border border-rule bg-white">
            {matchingDilemmas.length === 0 ? <p className="p-8 text-mute">{query ? 'No dilemmas match that search. Try another phrase or submit your own.' : 'No published dilemmas yet. Check back soon or submit one below.'}</p> : matchingDilemmas.map((d) => { const count = counts[d.id] ?? {a:0,b:0}; const close = effectiveCloseAt(d.closesAt, dailyCloseById.get(d.id) ?? null); return <DuelStrip key={d.id} d={d} total={count.a + count.b} closed={isClosed({closesAt:close})} deadHeat={isDeadHeat(count)} hot={isHot(count)} />; })}
          </div>
        </section>
      </div>
    </main>
  );
}
