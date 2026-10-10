'use client';
import { useState } from 'react';
import { track } from '@/lib/analytics';

export default function ReportBox({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [targetType, setTargetType] = useState<'dilemma' | 'discussion'>('dilemma');
  const [reason, setReason] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, targetType, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'We couldn\u2019t send that report. Try again.');
        setState('idle');
        return;
      }
      track('report_submitted', { slug, target: targetType });
      setState('sent');
    } catch {
      setError('We couldn\u2019t send that report. Check your connection and try again.');
      setState('idle');
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="report-form"
        onClick={() => setOpen((o) => !o)}
        className="text-sm font-semibold text-mute underline underline-offset-4 hover:text-ink"
      >
        Report this dilemma or a comment
      </button>
      {open && (
        <div id="report-form" className="mt-3 max-w-xl bg-white p-4">
          {state === 'sent' ? (
            <p role="status" className="font-semibold">Thanks. A person will review this report.</p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <fieldset>
                <legend className="font-bold">What are you reporting?</legend>
                <label className="mt-1 flex items-center gap-2">
                  <input type="radio" name="target" checked={targetType === 'dilemma'} onChange={() => setTargetType('dilemma')} />
                  This dilemma
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="target" checked={targetType === 'discussion'} onChange={() => setTargetType('discussion')} />
                  A comment in the discussion
                </label>
              </fieldset>
              <div>
                <label htmlFor="report-reason" className="font-bold">What is wrong?</label>
                <textarea
                  id="report-reason"
                  required
                  minLength={5}
                  maxLength={500}
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full border-2 border-ink p-2"
                  placeholder="For a comment, say who wrote it and quote a few words so we can find it."
                />
              </div>
              {error && <p role="alert" className="font-medium text-sideb">{error}</p>}
              <button type="submit" disabled={state === 'sending'} className="bg-ink px-4 py-2 font-bold text-white hover:bg-sidea disabled:opacity-60">
                {state === 'sending' ? 'Sending' : 'Send report'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
