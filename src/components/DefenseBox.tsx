'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Defense, Side } from '@/lib/types';

interface Props {
  slug: string;
  hasVoted: boolean;
  sideALabel: string;
  sideBLabel: string;
  closed: boolean;
  initialDefense: Defense | null;
  featuredDefense: Defense | null;
}

export default function DefenseBox({
  slug,
  hasVoted,
  sideALabel,
  sideBLabel,
  closed,
  initialDefense,
  featuredDefense,
}: Props) {
  const router = useRouter();
  const [defense, setDefense] = useState(initialDefense);
  const [featured, setFeatured] = useState(featuredDefense);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const label = (side: Side) => (side === 'a' ? sideALabel : sideBLabel);

  async function endorse() {
    if (!featured) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/defense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'endorse', slug, defenseId: featured.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || 'We couldn\u2019t endorse that defense. Try again.');
        return;
      }
      setFeatured({ ...featured, endorsements: data.endorsements, endorsedByMe: true });
      router.refresh();
    } catch {
      setError('We couldn\u2019t endorse that defense. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  if (!defense && !(closed && featured)) return null;

  return (
    <section aria-label="Defense results" className="mt-8">
      {defense && (
        <p className="mt-4 border-l-4 border-sideb bg-white px-4 py-3">
          <span className="block text-xs font-extrabold uppercase tracking-wide text-mute">Your defense · {label(defense.side)}</span>
          <span className="mt-1 block font-semibold">{defense.body}</span>
        </p>
      )}

      {closed && featured && (
        <div className="mt-5 border-l-4 border-sidea bg-white px-4 py-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-mute">Most-endorsed defense · {label(featured.side)}</p>
          <p className="mt-1 text-lg font-semibold">&ldquo;{featured.body}&rdquo;</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm text-mute">{featured.endorsements} {featured.endorsements === 1 ? 'endorsement' : 'endorsements'}</span>
            {hasVoted && !featured.endorsedByMe && (
              <button
                type="button"
                onClick={endorse}
                disabled={pending}
                className="border-2 border-ink px-3 py-1 font-bold hover:bg-rule disabled:opacity-50"
              >
                Endorse this argument
              </button>
            )}
            {featured.endorsedByMe && <span className="text-sm font-bold">You endorsed this</span>}
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 border-l-4 border-sideb bg-white px-3 py-2 font-medium">{error}</p>}
    </section>
  );
}
