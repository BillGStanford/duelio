import type { Metadata } from 'next';
import Link from 'next/link';
import MatchupHome from '@/components/MatchupHome';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Polls & Matchups',
  description: 'Vote on community polls or create a permanent matchup between any two people, ideas, teams, or things.',
  alternates: { canonical: '/polls' },
};

export default async function PollsPage() {
  const dilemmas = (await getStore().listDilemmas({ status: 'published' }))
    .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));
  return (
    <main className="mx-auto max-w-5xl px-5 pb-12">
      <section className="border-b border-rule py-10 sm:py-14">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-sidea">Duelio · public opinion</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">Polls &amp; matchups.</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-mute">Vote on everyday questions or pit any two people, ideas, teams, and things against each other. No account. No money. Just public opinion.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#polls" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-sidea px-5 py-3 font-extrabold text-white hover:brightness-95">Browse polls</a>
          <a href="#matchups" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-rule bg-white px-5 py-3 font-extrabold hover:bg-[#f2f3ff]">Explore matchups</a>
        </div>
      </section>
      <section id="polls" className="scroll-mt-5 py-9">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-widest text-sidea">Community polls</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Questions people are answering</h2><p className="mt-2 text-mute">Pick a side and see the conversation behind the question.</p></div>
          <Link href="/submit" className="font-bold underline underline-offset-4 hover:text-sidea">Submit a poll ↗</Link>
        </div>
        {dilemmas.length ? <div className="mt-5 grid auto-rows-fr gap-4 md:grid-cols-2">{dilemmas.map(d => (
          <article key={d.id} className="flex h-full flex-col rounded-2xl border border-rule bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black leading-snug">{d.question}</h3>
            {d.context && <p className="mt-2 line-clamp-3 leading-relaxed text-mute">{d.context}</p>}
            <div className="mt-4 grid flex-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-[#f2f3ff] p-3"><p className="text-xs font-black uppercase tracking-wider text-sidea">Side A</p><p className="mt-1 font-bold">{d.sideALabel}</p><p className="mt-1 line-clamp-3 text-sm text-mute">{d.sideADescription}</p></div>
              <div className="rounded-xl bg-[#fff1f4] p-3"><p className="text-xs font-black uppercase tracking-wider text-sideb">Side B</p><p className="mt-1 font-bold">{d.sideBLabel}</p><p className="mt-1 line-clamp-3 text-sm text-mute">{d.sideBDescription}</p></div>
            </div>
            <Link href={`/d/${d.slug}`} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-ink px-4 py-3 text-center font-extrabold text-white hover:bg-sidea">Vote &amp; view results →</Link>
          </article>
        ))}</div> : <div className="mt-5 rounded-2xl border border-rule bg-white p-6 text-mute">No published polls yet. Submit the first question to get the conversation started.</div>}
      </section>
      <div className="border-t border-rule pt-2"><MatchupHome /></div>
    </main>
  );
}
