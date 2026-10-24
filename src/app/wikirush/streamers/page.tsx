import type { Metadata } from 'next';
import Link from 'next/link';

const title = 'WikiRush for Streamers: Play Wikipedia Races With Your Chat';
const description = 'WikiRush is a free Wikipedia game made for streams. Streamer mode, one-link chat challenges, an auto-recorded branded clip, and a daily challenge your whole community can play.';

export const metadata: Metadata = {
  title: { absolute: title }, description, alternates: { canonical: '/wikirush/streamers' },
  openGraph: { title, description, type: 'article', siteName: 'Duelio', url: '/wikirush/streamers', images: ['/wikirush/wr-og.png'] },
};

const perks = [
  ['Chat plays along', 'Every game makes a challenge link. Paste it in chat and viewers play the exact same pages, then post their scores to compare.'],
  ['Streamer mode', 'Hides your account name and email on screen. Add ?stream=1 to any WikiRush link to switch it on.'],
  ['Clip that makes itself', 'Turn on recording and the run, with the WikiRush overlay, shows a Download popup when the game ends. Upload it straight to TikTok, Shorts or Reels.'],
  ['Daily Challenge', 'One shared daily set gives your community a reason to come back every stream.'],
  ['No download, no login to start', 'It runs in the browser, so it works as an OBS browser or window capture. The first game needs no account.'],
];

export default function Streamers() {
  return <main className="mx-auto max-w-3xl px-5 py-12 text-slate-700">
    <p className="text-xs font-black uppercase tracking-[.2em] text-[#5968ec]">For creators</p>
    <h1 className="mt-2 text-4xl font-black tracking-tight text-[#101426] sm:text-5xl">WikiRush for streamers</h1>
    <p className="mt-4 text-lg leading-relaxed">A game your chat can understand in five seconds, play in ninety, and argue about for the rest of the stream.</p>
    <div className="mt-8 grid gap-4">
      {perks.map(([t, d]) => <div key={t} className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black text-[#101426]">{t}</h2><p className="mt-1 text-sm leading-relaxed">{d}</p></div>)}
    </div>
    <h2 className="mt-12 text-2xl font-black text-[#101426]">Run a WikiRush stream in 30 seconds</h2>
    <ol className="mt-4 list-decimal space-y-2 pl-6 leading-relaxed">
      <li>Open <Link href="/wikirush?stream=1" className="font-bold text-[#3b46c4] underline">wikirush with streamer mode on</Link>.</li>
      <li>Hit Play. Finish the game, then copy the chat challenge.</li>
      <li>Paste it in chat: everyone plays your exact pages. Compare scores, rematch, repeat.</li>
    </ol>
    <p className="mt-10"><Link href="/wikirush?play=1&stream=1" className="inline-flex rounded-2xl bg-[#6978f5] px-7 py-4 text-lg font-black text-white shadow-lg hover:bg-[#5866df]">▶ Play now</Link></p>
  </main>;
}
