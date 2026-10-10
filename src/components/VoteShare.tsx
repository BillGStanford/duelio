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
}: {
  slug: string;
  side: Side;
  label: string;
  question: string;
  closesAt: string | null;
}) {
  return (
    <div className="mt-8 border-t-4 border-ink pt-5">
      <h3 className="text-2xl font-extrabold tracking-tight">Your vote card</h3>
      <p className="mt-1 text-mute">
        Post it and let your friends try to change your mind.{closesAt ? ` Voting closes ${formatCloseDate(closesAt)}.` : ''}
      </p>
      <CardShare
        src={(f) => `/card/${slug}/${side}?fmt=${f}`}
        filename={`duelio-${slug}`}
        shareText={`I picked ${label}. Do you agree? ${question}`}
        alt={`Vote card: I picked ${label}. ${question} Do you agree?`}
        event="card_shared"
        slug={slug}
      />
    </div>
  );
}
