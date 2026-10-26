'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { loadStats } from '@/lib/wikirush/stats';
import { Pip } from './Art';
import PlayerCard from './PlayerCard';

export default function HomeHero({ dailyKey, dailyNumber }: { dailyKey: string; dailyNumber: number }) {
  const [done, setDone] = useState(false);
  useEffect(() => { try { setDone(loadStats().daily[dailyKey] !== undefined); } catch { /* ignore */ } }, [dailyKey]);
  return <section aria-label="WikiRush title screen" className="gx-screen">
    <picture>
      <source media="(max-width: 700px)" srcSet="/game/hero-mobile.jpg" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/game/hero.jpg" alt="" fetchPriority="high" className="gx-stars h-full w-full object-cover" />
    </picture>
    <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[#0b0f1f]/40 sm:bg-transparent" style={{ background: 'linear-gradient(90deg, rgba(11,15,31,.93) 0%, rgba(11,15,31,.72) 40%, rgba(11,15,31,.12) 100%), linear-gradient(180deg, rgba(11,15,31,0) 40%, #0b0f1f 100%)' }} />
    <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 pb-16 pt-10 sm:pt-14 lg:min-h-[600px] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] lg:pb-20">
      <div className="gx-rise">
        <p className="gx-eyebrow">The Wikipedia link race</p>
        <h1 className="gx-h mt-3 text-6xl sm:text-8xl">Wiki<span className="text-[#aeb7ff]">Rush</span></h1>
        <p className="mt-4 max-w-md text-lg font-medium text-white/80 sm:text-xl">Get from one Wikipedia page to another using only links. Fastest route wins.</p>
        <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link href="/wikirush?play=1" className="gx-btn gx-btn-lg">▶ PLAY</Link>
          <Link href="/wikirush?daily=1" className="gx-btn gx-btn-gold">📅 Daily #{dailyNumber}{done ? ' ✓' : ''}</Link>
        </div>
        <p className="mt-4 text-sm font-medium text-white/60">Free · your first game needs no account · 90 seconds a round</p>
      </div>
      <div className="relative gx-rise" style={{ animationDelay: '.12s' }}>
        <div className="pointer-events-none absolute -top-16 right-2 hidden sm:block lg:-top-24 lg:right-6"><Pip size={110} float /></div>
        <PlayerCard />
      </div>
    </div>
  </section>;
}
