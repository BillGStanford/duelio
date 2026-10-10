'use client';
import { useEffect, useState } from 'react';
import { MIN_DEBATES, MIN_TOTAL_VOTES, type Take } from '@/lib/alignment';
import CardShare from './CardShare';

export default function TakeCard({ refreshKey }: { refreshKey: string }) {
  const [take, setTake] = useState<Take | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/take', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => live && t && setTake(t))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [refreshKey]);

  if (!take) return null;

  return (
    <div className="mt-8 bg-white p-5">
      <h3 className="text-2xl font-extrabold tracking-tight">Your take</h3>
      {take.pct === null ? (
        <p className="mt-1">
          {take.considered} of {MIN_DEBATES} debates counted so far. Vote on more debates to see how often you side with the crowd.
          <span className="block text-sm text-mute">A debate counts once {MIN_TOTAL_VOTES} people have voted and the crowd has a clear favorite.</span>
        </p>
      ) : (
        <>
          <p className="mt-1 text-5xl font-extrabold tracking-tight">{take.pct}%</p>
          <p className="font-semibold">
            You side with the crowd {take.pct}% of the time ({take.withCrowd} of {take.considered} debates).
          </p>
          <p className="text-mute">{take.label}.</p>
          <CardShare
            src={(f) => `/card/take?fmt=${f}`}
            filename="duelio-my-take"
            shareText={`I side with the crowd ${take.pct}% of the time on Duelio. How often do you?`}
            alt={`My take: I side with the crowd ${take.pct}% of the time. ${take.label}.`}
            event="take_shared"
            defaultFmt="story"
          />
        </>
      )}
    </div>
  );
}
