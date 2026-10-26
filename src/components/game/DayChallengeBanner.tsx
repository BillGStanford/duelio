'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Featured } from '@/lib/wikirush/featured';
import ChallengeBoard from './ChallengeBoard';
import ShareChallenge from './ShareChallenge';

/** Advertises the newest Day N Challenge: play, share, and the top scores. Renders nothing when none is live. */
export default function DayChallengeBanner() {
  const [f, setF] = useState<Featured | null>(null);
  useEffect(() => {
    fetch('/api/wikirush/featured').then(r => r.json()).then((d: { featured?: Featured[] }) => {
      const list = (d.featured || []).slice().sort((a, b) => (b.day || 0) - (a.day || 0) || b.createdAt.localeCompare(a.createdAt));
      setF(list[0] ?? null);
    }).catch(() => {});
  }, []);
  if (!f) return null;
  const first = f.pairs[0];
  return <section aria-label={f.day ? `Day ${f.day} Challenge` : 'New challenge'} className="mx-auto max-w-6xl px-5 pt-2">
    <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-[#fbbf24] via-[#fb7185] to-[#6978f5] p-[2px] shadow-[0_0_60px_rgba(251,113,133,.25)]">
      <div className="grid gap-6 rounded-[22px] bg-[#0e1330] p-5 sm:p-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
        <div>
          <p className="gx-eyebrow !text-[var(--gx-gold)]">{f.day ? `Day ${f.day} Challenge` : 'New challenge'} · live now</p>
          <h2 className="gx-h mt-2 text-3xl sm:text-4xl">{f.title}</h2>
          {f.blurb && <p className="mt-2 text-white/70">{f.blurb}</p>}
          <p className="mt-3 text-lg font-semibold">{first.start} <span className="text-[#aeb7ff]">→</span> {first.target}{f.pairs.length > 1 && <span className="text-white/55"> +{f.pairs.length - 1} more</span>}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link href={`/wikirush?f=${encodeURIComponent(f.id)}#feat-${f.id}`} className="gx-btn gx-btn-gold">Play the challenge</Link>
            <ShareChallenge f={f} />
            <Link href="/records" className="text-sm font-bold text-[#aeb7ff] no-underline hover:text-white">World records →</Link>
          </div>
        </div>
        <div>
          <p className="gx-label">Top scores</p>
          <ChallengeBoard featuredId={f.id} limit={3} />
        </div>
      </div>
    </div>
  </section>;
}
