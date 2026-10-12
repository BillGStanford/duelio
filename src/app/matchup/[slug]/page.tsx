import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import MatchupExperience from '@/components/MatchupExperience';
import { getActiveRound, getClosedWinner, getMatchup, getRoundCounts, getRoundHistory, getVoterSide } from '@/lib/matchups';
import { hashVoter, VOTER_COOKIE } from '@/lib/auth';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params, searchParams }: { params: { slug: string }; searchParams?: { voted?: string } }): Promise<Metadata> {
  const matchup = await getMatchup(params.slug);
  if (!matchup || matchup.status !== 'published') return { title: 'Matchup not found', robots: { index: false, follow: false } };
  const description = `Who wins: ${matchup.nameA} or ${matchup.nameB}? Vote in this free public-opinion matchup on Duelio. No accounts, no money.`;
  const voted = searchParams?.voted === 'b' ? 'b' : 'a';
  const image = `${SITE_URL}/matchup-card/${matchup.slug}/${voted}?fmt=wide`;
  return {
    title: `${matchup.nameA} vs. ${matchup.nameB}`,
    description,
    alternates: { canonical: `${SITE_URL}/matchup/${matchup.slug}` },
    openGraph: { type: 'article', siteName: 'Duelio', title: `${matchup.nameA} vs. ${matchup.nameB} | Duelio`, description, url: `${SITE_URL}/matchup/${matchup.slug}`, images: [{ url: image, width: 1200, height: 630, alt: `I voted for ${voted === 'a' ? matchup.nameA : matchup.nameB} in this Duelio matchup` }] },
    twitter: { card: 'summary_large_image', title: `${matchup.nameA} vs. ${matchup.nameB} | Duelio`, description, images: [image] },
  };
}
export default async function MatchupPage({ params }: { params: { slug: string } }) {
  const matchup = await getMatchup(params.slug);
  if (!matchup || matchup.status !== 'published') notFound();
  try {
    const round = await getActiveRound(matchup.id);
    const rawVoterId = cookies().get(VOTER_COOKIE)?.value;
    const voterHash = rawVoterId && /^[0-9a-f-]{36}$/.test(rawVoterId) ? hashVoter(rawVoterId) : null;
    const [counts, history, champion, votedSide] = await Promise.all([
      getRoundCounts(round.id), getRoundHistory(matchup.id), getClosedWinner(matchup.id),
      voterHash ? getVoterSide(round.id, voterHash) : Promise.resolve(null),
    ]);
    const latestClosed = history.find(r => r.status === 'closed' && r.closedAt);
    const initial = {
      matchup, round, counts, history, champion, votedSide,
      showWinnerAnimation: !!latestClosed?.closedAt && Date.now() - Date.parse(latestClosed.closedAt) < 30000,
    };
    return <MatchupExperience initial={initial} />;
  } catch {
    return <main className="mx-auto max-w-3xl px-5 py-16"><h1 className="text-3xl font-black">Matchups are being prepared.</h1><p className="mt-3 text-mute">The administrator needs to apply the matchup database migration before voting can begin.</p><a href="/" className="mt-5 inline-block rounded-xl bg-ink px-5 py-3 font-bold text-white">Back to Duelio</a></main>;
  }
}
