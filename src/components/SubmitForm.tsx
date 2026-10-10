'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { track } from '@/lib/analytics';

export default function SubmitForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [error, setError] = useState('');
  const started = useRef(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: f.get('question'),
          sideA: f.get('sideA'),
          sideB: f.get('sideB'),
          context: f.get('context'),
          submitterName: f.get('submitterName'),
          website: f.get('website'),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'We couldn\u2019t save your dilemma. Try again.');
        setState('idle');
        return;
      }
      track('submission_completed');
      setPublishedSlug(typeof data?.slug === 'string' ? data.slug : null);
      setState('sent');
    } catch {
      setError('We couldn\u2019t save your dilemma. Check your connection and try again.');
      setState('idle');
    }
  }

  if (state === 'sent') {
    return (
      <div role="status" className="border-t-4 border-ink pt-5">
        <p className="text-3xl font-extrabold tracking-tight">It&apos;s live.</p>
        <p className="mt-2 text-lg">Your dilemma is published and included in the main feed.</p>
        {publishedSlug && (
          <Link href={`/d/${publishedSlug}`} className="mt-4 inline-flex min-h-12 items-center bg-ink px-5 py-3 font-bold text-white hover:bg-sidea">
            View and share your dilemma
          </Link>
        )}
      </div>
    );
  }

  const field = 'mt-1 w-full border-2 border-ink bg-white p-3 text-base';
  return (
    <form
      onSubmit={onSubmit}
      onFocus={() => {
        if (!started.current) {
          started.current = true;
          track('submission_started');
        }
      }}
      className="space-y-5"
    >
      <p className="border-l-4 border-ink bg-white px-3 py-2">
        Keep it playful. Don&apos;t submit private conversations, personal accusations, identifying information, or claims about real people.
      </p>
      <div>
        <label htmlFor="question" className="font-bold">Question</label>
        <input id="question" name="question" required minLength={10} maxLength={140} className={field} placeholder="Should couples share their phone passwords?" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="sideA" className="font-bold">Side A</label>
          <input id="sideA" name="sideA" required minLength={3} maxLength={120} className={field} placeholder="Yes. Transparency matters." />
        </div>
        <div>
          <label htmlFor="sideB" className="font-bold">Side B</label>
          <input id="sideB" name="sideB" required minLength={3} maxLength={120} className={field} placeholder="No. Privacy still matters inside a relationship." />
        </div>
      </div>
      <div>
        <label htmlFor="context" className="font-bold">Context <span className="font-normal text-mute">(optional)</span></label>
        <textarea id="context" name="context" rows={2} maxLength={280} className={field} placeholder="One or two lines that set the scene." />
      </div>
      <div>
        <label htmlFor="submitterName" className="font-bold">Your name <span className="font-normal text-mute">(optional, shown publicly with your dilemma)</span></label>
        <input id="submitterName" name="submitterName" maxLength={40} autoComplete="nickname" className={field} />
      </div>
      {/* Honeypot: hidden from people and assistive tech */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
        <label htmlFor="website">Leave this empty</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {error && <p role="alert" className="border-l-4 border-sideb bg-white px-3 py-2 font-medium">{error}</p>}
      <button type="submit" disabled={state === 'sending'} className="bg-ink px-6 py-3 text-lg font-bold text-white hover:bg-sidea disabled:opacity-60">
        {state === 'sending' ? 'Sending' : 'Submit dilemma'}
      </button>
    </form>
  );
}
