'use client';
import { useEffect, useState } from 'react';
import { track } from '@/lib/analytics';
import type { Results } from '@/lib/types';

interface Props {
  slug: string;
  room: string;
  labelA: string;
  labelB: string;
  initial: { total: number; voted: boolean; inRoom: boolean; results: Results | null };
}

export default function GroupPanel({ slug, room, labelA, labelB, initial }: Props) {
  const [s, setS] = useState(initial);
  const [error, setError] = useState('');

  async function refresh() {
    try {
      const r = await fetch(`/api/room?slug=${slug}&g=${room}`, { cache: 'no-store' });
      if (r.ok) setS(await r.json());
    } catch {
      /* keep the last known tally */
    }
  }

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, room]);

  async function join() {
    setError('');
    try {
      const r = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, room }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d?.error || 'We couldn\u2019t add your vote to the group. Try again.');
        return;
      }
      track('group_joined', { slug });
      await refresh();
    } catch {
      setError('We couldn\u2019t add your vote to the group. Try again.');
    }
  }

  const res = s.results;
  return (
    <section aria-labelledby="group-heading" className="mt-8 bg-ink p-5 text-white">
      <h2 id="group-heading" className="text-2xl font-extrabold tracking-tight">
        {s.inRoom && res ? 'Group chat verdict so far' : 'Group chat verdict pending'}
      </h2>
      <div aria-live="polite" className="mt-2">
        {!s.voted && (
          <p className="text-lg">
            {s.total === 0
              ? 'You\u2019re first in. Vote, then send this same link back to the chat.'
              : `${s.total} ${s.total === 1 ? 'person has' : 'people have'} voted in this group chat. Vote to see how they split.`}
          </p>
        )}
        {s.voted && !s.inRoom && (
          <div>
            <p className="text-lg">You voted before opening this link, so you aren&apos;t counted in this group yet.</p>
            <button type="button" onClick={join} className="mt-3 bg-white px-4 py-2 font-bold text-ink hover:bg-rule">
              Count my vote in this chat
            </button>
          </div>
        )}
        {s.inRoom && res && (
          <div>
            <div role="img" aria-label={`Group split: ${res.a} ${labelA}, ${res.b} ${labelB}`} className="flex h-5 w-full overflow-hidden bg-mute ring-1 ring-white">
              <div className="h-full bg-sidea transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${res.pctA}%` }} />
              <div className="h-full flex-1 bg-sideb" />
            </div>
            <p className="mt-2 flex flex-wrap justify-between gap-2 text-lg font-bold">
              <span>{res.a} {labelA}</span>
              <span className="font-normal">{res.total} {res.total === 1 ? 'vote' : 'votes'}</span>
              <span>{res.b} {labelB}</span>
            </p>
            <p className="mt-1 text-sm text-rule">Updates live. Send the link to anyone who hasn&apos;t voted.</p>
          </div>
        )}
      </div>
      {error && <p role="alert" className="mt-2 font-semibold text-white underline decoration-sideb decoration-4">{error}</p>}
    </section>
  );
}
