import type { Metadata } from 'next';
import MatchupHome from '@/components/MatchupHome';

export const metadata: Metadata = {
  title: 'Matchups',
  description: 'Vote in head-to-head matchups, make your case, and see where public opinion lands.',
  alternates: { canonical: 'https://www.duelio.ink/matchups' },
};

export const dynamic = 'force-dynamic';

export default function MatchupsPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 pb-12">
      <section className="border-b border-rule py-10 sm:py-14">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sidea">Duelio · Public opinion</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">The matchup board.</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-mute sm:text-xl">Two sides. One public verdict. Vote in the matchups you care about, make your case, and help decide who comes out on top.</p>
      </section>
      <MatchupHome limit={24} />
    </main>
  );
}
