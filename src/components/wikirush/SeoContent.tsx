import Link from 'next/link';
import { WR_FAQ } from '@/lib/wikirush/seo';

/** Crawlable, human-useful text under the game: what it is, how it works, and the FAQ. */
export default function SeoContent() {
  return <section aria-labelledby="wr-about" className="mx-auto max-w-4xl px-5 py-14 text-slate-700">
    <h2 id="wr-about" className="text-3xl font-black tracking-tight text-[#101426]">WikiRush: the Wikipedia link race game</h2>
    <p className="mt-4 leading-relaxed">
      WikiRush is a free online Wikipedia game, also known as wikiracing. You start on one Wikipedia article and have to reach another using only the links inside the articles. No search bar, no back-door shortcuts, just your brain and the clock. Think of it as GeoGuessr for Wikipedia: every round drops you somewhere unexpected and rewards a good sense of how the world connects.
    </p>
    <div className="mt-8 grid gap-4 sm:grid-cols-3">
      {[['Daily Challenge', 'The same five rounds for everyone, every day. Compare scores like you would in Wordle.'], ['Challenge links', 'Send one link and a friend plays the exact same pages. Beat their score or lose the bet.'], ['Share your score', 'Download a score card with your rank and route, ready for socials or your stream.']].map(([t, d]) =>
        <div key={t} className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-black text-[#101426]">{t}</h3><p className="mt-2 text-sm leading-relaxed">{d}</p></div>)}
    </div>
    <h2 className="mt-12 text-2xl font-black tracking-tight text-[#101426]">WikiRush questions, answered</h2>
    <dl className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
      {WR_FAQ.map(f => <div key={f.q} className="p-5"><dt className="font-extrabold text-[#101426]">{f.q}</dt><dd className="mt-1 text-sm leading-relaxed">{f.a}</dd></div>)}
    </dl>
    <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold">
      <Link href="/wikirush/how-to-play" className="text-[#3b46c4] underline underline-offset-4">How to play and win tips</Link>
      <Link href="/wikirush/streamers" className="text-[#3b46c4] underline underline-offset-4">WikiRush for streamers</Link>
      <Link href="/leaderboard" className="text-[#3b46c4] underline underline-offset-4">Leaderboard</Link>
    </p>
  </section>;
}
