import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/wikirush/JsonLd';

const title = 'How to Play WikiRush: Rules, Scoring and Wikipedia Race Tips';
const description = 'Learn how to play WikiRush, the Wikipedia link race game. Rules, scoring, Radar, the Daily Challenge, and the hub strategy that wins Wikipedia races.';

export const metadata: Metadata = {
  title: { absolute: title }, description, alternates: { canonical: '/wikirush/how-to-play' },
  openGraph: { title, description, type: 'article', siteName: 'Duelio', url: '/wikirush/how-to-play', images: ['/game/og.png'] },
};

const steps = [
  ['Read your start and destination', 'Every round shows two real Wikipedia articles before the clock starts.'],
  ['Click links inside the article', 'Only links in the article text count. Search, the address bar and outside sites are off limits.'],
  ['Reach the destination', 'The round ends the moment you land on the target page. Fewer clicks and a faster time score more.'],
  ['Score, share, rematch', 'Each round is worth up to 5,000 points. Send a challenge link so friends play the exact same pages.'],
];

export default function HowToPlay() {
  return <main className="mx-auto max-w-3xl px-5 py-12 text-slate-700">
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'HowTo', name: 'How to play WikiRush', step: steps.map(([name, text]) => ({ '@type': 'HowToStep', name, text })) }} />
    <p className="text-xs font-black uppercase tracking-[.2em] text-[#5968ec]">WikiRush guide</p>
    <h1 className="mt-2 text-4xl font-black tracking-tight text-[#101426] sm:text-5xl">How to play WikiRush</h1>
    <p className="mt-4 text-lg leading-relaxed">WikiRush is a Wikipedia link race. Start on one article, reach another using only links, and beat the clock.</p>
    <ol className="mt-8 space-y-4">
      {steps.map(([t, d], i) => <li key={t} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#6978f5] font-black text-white">{i + 1}</span><span><span className="block font-extrabold text-[#101426]">{t}</span>{d}</span></li>)}
    </ol>
    <h2 className="mt-12 text-2xl font-black text-[#101426]">Tips that win Wikipedia races</h2>
    <ul className="mt-4 list-disc space-y-3 pl-6 leading-relaxed">
      <li><strong>Climb to a hub first.</strong> Countries, big cities, years and universal topics link to almost everything.</li>
      <li><strong>Think backwards.</strong> What does the destination page link from? A person leads to their country, a planet leads to astronomy.</li>
      <li><strong>Use the lead paragraph.</strong> The first few sentences have the densest, most useful links.</li>
      <li><strong>Radar costs 600 points</strong> but highlights the destination if the page links to it. Use it when the clock is running out.</li>
      <li><strong>Pages load instantly.</strong> WikiRush prefetches the links you are about to click and pauses the clock if a page is slow.</li>
    </ul>
    <h2 className="mt-12 text-2xl font-black text-[#101426]">Game modes</h2>
    <p className="mt-3 leading-relaxed">Play the <strong>Daily Challenge</strong> (same five rounds for everyone), <strong>Classic</strong> (fresh curated pairs with a shareable seed), <strong>Wild</strong> (a truly random Wikipedia page) or accept a friend&apos;s <strong>challenge link</strong>.</p>
    <p className="mt-10"><Link href="/wikirush?play=1" className="inline-flex rounded-2xl bg-[#6978f5] px-7 py-4 text-lg font-black text-white shadow-lg hover:bg-[#5866df]">▶ Play WikiRush free</Link></p>
  </main>;
}
