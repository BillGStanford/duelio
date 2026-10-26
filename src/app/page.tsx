import Link from 'next/link';
import MatchupHome from '@/components/MatchupHome';
import DuelStrip from '@/components/DuelStrip';
import DayChallengeBanner from '@/components/game/DayChallengeBanner';
import HomeHero from '@/components/game/HomeHero';
import ModeCard from '@/components/game/ModeCard';
import TopPlayers from '@/components/game/TopPlayers';
import { dailyNumber } from '@/lib/wikirush/rounds';
import JsonLd from '@/components/wikirush/JsonLd';
import { gameJsonLd, siteJsonLd } from '@/lib/wikirush/seo';
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
      <JsonLd data={siteJsonLd()} />
      <JsonLd data={gameJsonLd()} />
      <HomeHero dailyKey={today} dailyNumber={dailyNumber(today)} />

      <div className="gx-screen pb-24">
        <DayChallengeBanner />
        <div className="mx-auto mt-10 max-w-6xl px-5">
          <section aria-labelledby="modes-h" className="pt-2">
            <p className="gx-eyebrow">WikiRush</p>
            <h2 id="modes-h" className="gx-h mt-2 text-3xl sm:text-4xl">Pick your challenge</h2>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              <ModeCard href="/wikirush?pick=daily#play" img="/game/mode-daily.jpg" tag="Same for all" title="Daily Challenge" text="Five rounds. The same pages for everyone, once a day." />
              <ModeCard href="/wikirush?pick=quick#play" img="/game/mode-quick.jpg" tag="Quick" title="Quick Play" text="Fresh pages, picked for your level. Jump straight in." />
              <ModeCard href="/wikirush?pick=hard#play" img="/game/mode-hard.jpg" tag="Expert" title="Hard Mode" text="Far-apart pages and no easy hubs. Bring your best route." />
              <ModeCard href="/wikirush?pick=wild#play" img="/game/mode-wild.jpg" tag="Chaos" title="Wild" text="Start on a random page. The target is still famous." />
            </div>
          </section>

          <section aria-labelledby="more-h" className="mt-14">
            <p className="gx-eyebrow">More Duelio games</p>
            <h2 id="more-h" className="gx-h mt-2 text-3xl sm:text-4xl">Pick a side</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-5">
              <ModeCard wide href="/matchups" img="/game/mode-duel.jpg" tag="Vote" title="Duel" text="Two legends, one vote. Settle the GOAT debate." cta="Vote now" />
              <ModeCard wide href="/#debates" img="/game/mode-dilemma.jpg" tag="Vote" title="Dilemma" text={`${n} tough ${n === 1 ? 'choice' : 'choices'}. Pick a side and see what the crowd thinks.`} cta="Choose" />
            </div>
          </section>

          <div className="mt-14 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
            <section aria-labelledby="how-h" className="gx-card p-6">
              <h2 id="how-h" className="text-lg font-bold">How to play</h2>
              <ol className="mt-4 grid gap-4 sm:grid-cols-3">
                {[['1', 'Read the mission', 'You get a start page and a target page.'], ['2', 'Click links', 'Only links. No search. Think of hubs that lead to your target.'], ['3', 'Beat the clock', 'Fewer clicks and less time means a bigger score.']].map(([k, t, d]) => <li key={k}><span className="grid h-9 w-9 place-items-center rounded-full bg-[#6978f5] font-bold">{k}</span><p className="mt-3 font-bold">{t}</p><p className="mt-1 text-sm text-white/65">{d}</p></li>)}
              </ol>
              <Link href="/wikirush/how-to-play" className="mt-5 inline-flex text-sm font-bold text-[#aeb7ff] no-underline hover:text-white">Full guide →</Link>
            </section>
            <TopPlayers />
          </div>
        </div>
      </div>

      <div className="gx-sheet pt-10">
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
      </div>
    </main>
  );
}
