import type { ReactNode } from 'react';

/** Dark full-bleed game screen used by Profile, Settings and Leaderboard. */
export default function Shell({ eyebrow, title, sub, children, wide }: { eyebrow: string; title: string; sub?: string; children: ReactNode; wide?: boolean }) {
  return <main className="gx-screen min-h-[calc(100vh-58px)] pb-20">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/game/auth.jpg" alt="" className="gx-stars h-full w-full object-cover opacity-60" />
    <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-[#0b0f1f]/50 via-[#0b0f1f]/85 to-[#0b0f1f]" />
    <div className={`mx-auto px-4 pt-10 sm:px-6 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
      <p className="gx-eyebrow">{eyebrow}</p>
      <h1 className="gx-h mt-2 text-4xl sm:text-5xl">{title}</h1>
      {sub && <p className="mt-3 max-w-xl text-white/70">{sub}</p>}
      <div className="mt-8">{children}</div>
    </div>
  </main>;
}
