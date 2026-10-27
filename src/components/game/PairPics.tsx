/* eslint-disable @next/next/no-img-element */
import type { Featured, PairPreview } from '@/lib/wikirush/featured';
import { teaserFor } from '@/lib/wikirush/featured';

function Pic({ p, fallback, tone }: { p?: PairPreview; fallback: string; tone: 'start' | 'target' }) {
  const title = p?.title || fallback;
  return <figure className={`min-w-0 flex-1 overflow-hidden rounded-2xl border-2 bg-[#141a36] ${tone === 'target' ? 'border-[#fb7185]/70' : 'border-[#aeb7ff]/60'}`}>
    <div className="grid aspect-[4/3] w-full place-items-center bg-gradient-to-br from-[#2b3370] to-[#141a36]">
      {p?.image ? <img src={p.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="text-5xl font-bold text-white/30">{title.slice(0, 1).toUpperCase()}</span>}
    </div>
    <figcaption className="px-3 py-2"><p className={`text-[10px] font-bold uppercase tracking-[.18em] ${tone === 'target' ? 'text-[#fb7185]' : 'text-[#aeb7ff]'}`}>{tone === 'target' ? 'Find this' : 'Start'}</p><p className="truncate text-sm font-bold">{title}</p></figcaption>
  </figure>;
}

/** The first round of a challenge: both pages with photos, plus the teaser line. */
export default function PairPics({ f }: { f: Featured }) {
  const first = f.pairs[0];
  return <div>
    <div className="flex items-center gap-2.5">
      <Pic p={f.preview?.start} fallback={first.start} tone="start" />
      <span className="text-2xl font-bold text-[var(--gx-gold)]" aria-hidden="true">→</span>
      <Pic p={f.preview?.target} fallback={first.target} tone="target" />
    </div>
    <p className="mt-3 text-sm font-semibold italic text-white/75">“{teaserFor(f)}”</p>
  </div>;
}
