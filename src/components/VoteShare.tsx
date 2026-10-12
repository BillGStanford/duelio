'use client';
import type { Side } from '@/lib/types';
import { formatCloseDate } from '@/lib/site';
import CardShare from './CardShare';

export default function VoteShare({
  slug,
  side,
  label,
  question,
  closesAt,
  shareUrl,
  matchup,
}: {
  slug: string;
  side: Side;
  label: string;
  question: string;
  closesAt: string | null;
  shareUrl?: string;
  matchup?: { nameA: string; nameB: string };
}) {
  return (
    <section aria-labelledby="vote-card-heading" className="mt-6 border-t-2 border-rule pt-4">
      <h3 id="vote-card-heading" className="text-xl font-extrabold tracking-tight">Make a vote card <span className="text-base font-normal text-mute">(optional)</span></h3>
      <p className="mt-2 text-mute">
        Post it and let your friends try to change your mind.{closesAt ? ` Voting closes ${formatCloseDate(closesAt)}.` : ''}
      </p>
      <CardShare
        src={(f) => matchup ? `/matchup-card/${slug}/${side}?fmt=${f}` : `/card/${slug}/${side}?fmt=${f}`}
        filename={`duelio-${slug}`}
        shareText={`I picked ${label}. Do you agree? ${question}`}
        alt={`Vote card: I picked ${label}. ${question} Do you agree?`}
        event="card_shared"
        slug={slug}
        shareUrl={shareUrl}
      />
    </section>
  );
}
