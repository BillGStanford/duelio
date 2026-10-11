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
    <details className="mt-6 border-t-2 border-rule pt-4">
      <summary className="cursor-pointer font-bold underline decoration-2 underline-offset-4">Make a vote card (optional)</summary>
      <p className="mt-2 text-mute">
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
    </details>
  );
}
