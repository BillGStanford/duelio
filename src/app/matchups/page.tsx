import type { Metadata } from 'next';
import MatchupHome from '@/components/MatchupHome';
import MatchupCreator from '@/components/MatchupCreator';

export const metadata: Metadata = {
  title: 'Matchups',
  description: 'Vote in head-to-head matchups, make your case, and see where public opinion lands.',
  alternates: { canonical: 'https://www.duelio.ink/matchups' },
};

export const dynamic = 'force-dynamic';

export default function MatchupsPage() {
  return (
    <main className="mx-auto max-w-[1600px] px-4 pb-12 sm:px-6 lg:px-8">
      <section className="border-b border-rule py-8 sm:py-10">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sidea">Duelio · Public opinion</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">The matchup library.</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-mute sm:text-xl">The home for settling GOAT debates. Compare the greats, settle rivalries, and see where public opinion lands.</p>
      </section>
      <MatchupCreator />
      <MatchupHome limit={10000} />
    </main>
  );
}
