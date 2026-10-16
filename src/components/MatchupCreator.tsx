'use client';
import { useState, type FormEvent } from 'react';

const QUICK_STARTS = [
  ['Alexander the Great', 'Napoleon'],
  ['Messi', 'Cristiano Ronaldo'],
  ['Batman', 'Spider-Man'],
  ['Marvel', 'DC'],
];

export default function MatchupCreator({ variant = 'inline', onClose }: { variant?: 'inline' | 'modal'; onClose?: () => void }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/matchups', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ a: a.trim(), b: b.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not create that matchup.');
      // Creation is complete: take the visitor directly to the voting page, with no popup.
      window.location.assign(new URL(result.url, window.location.origin).toString());
      return;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create that matchup.');
      setBusy(false);
    }
  }
  const modal = variant === 'modal';
  const Wrapper = modal ? 'div' : 'section';
  return (
    <Wrapper aria-labelledby={modal ? 'welcome-matchup-heading' : 'create-matchup-heading'} className={modal ? 'w-full' : 'mt-8 rounded-2xl border border-rule bg-white p-5 shadow-sm sm:p-7'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-sidea">Create a public matchup</p>
          <h2 id={modal ? 'welcome-matchup-heading' : 'create-matchup-heading'} className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Who wins the debate?</h2>
          <p className="mt-2 max-w-2xl text-mute">Enter any two people, characters, teams, ideas, or things. No account needed. Every matchup gets a permanent page and a fresh two-week round.</p>
        </div>
        <span className="rounded-full border border-rule bg-paper px-3 py-1 text-xs font-bold text-mute">FREE · NO BETTING</span>
      </div>
      {modal && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-mute">Need an idea? Try one</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_STARTS.map(([first, second]) => (
              <button key={first} type="button" onClick={() => { setA(first); setB(second); setError(''); }} className="rounded-full border border-rule bg-paper px-3 py-2 text-sm font-bold transition hover:border-sidea hover:bg-[#eef0ff]">
                {first} <span className="text-mute">vs.</span> {second}
              </button>
            ))}
          </div>
        </div>
      )}
      <form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto] md:items-end">
        <label className="block text-sm font-bold">First competitor
          <input value={a} onChange={e => setA(e.target.value)} required minLength={2} maxLength={100} placeholder="e.g. Alexander the Great" className="mt-1 block min-h-12 w-full rounded-xl border border-rule px-4 py-3 font-normal" autoFocus={modal} />
        </label>
        <span className="pb-3 text-center text-sm font-black uppercase text-mute">vs.</span>
        <label className="block text-sm font-bold">Second competitor
          <input value={b} onChange={e => setB(e.target.value)} required minLength={2} maxLength={100} placeholder="e.g. Napoleon" className="mt-1 block min-h-12 w-full rounded-xl border border-rule px-4 py-3 font-normal" />
        </label>
        <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-ink px-5 py-3 font-extrabold text-white transition hover:bg-sidea disabled:cursor-wait disabled:opacity-60">{busy ? 'Creating…' : 'Create matchup'}</button>
      </form>
      {error && <p role="alert" className="mt-3 rounded-lg bg-[#fff1f4] p-3 text-sm font-semibold">{error}</p>}
      <p className="mt-3 text-xs text-mute">Same two names, either order? Duelio takes you to the same canonical matchup.</p>
    </Wrapper>
  );
}
