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
  const [createdMatchup, setCreatedMatchup] = useState<{ a: string; b: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
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
      setCreatedMatchup({ a: a.trim(), b: b.trim(), url: new URL(result.url, window.location.origin).toString() });
      setCopied(false);
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create that matchup.');
      setBusy(false);
    }
  }
  const modal = variant === 'modal';
  const Wrapper = modal ? 'div' : 'section';
  const discordMessage = createdMatchup
    ? `🔥 I just created a new Duelio matchup: ${createdMatchup.a} vs. ${createdMatchup.b}\n\nCast your vote and join the debate: ${createdMatchup.url}\n\nWho do you think should win? Tell us why!`
    : '';
  async function copyDiscordMessage() {
    if (!discordMessage) return;
    try {
      await navigator.clipboard.writeText(discordMessage);
      setCopied(true);
    } catch {
      const area = document.createElement('textarea');
      area.value = discordMessage;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const success = document.execCommand('copy');
      area.remove();
      setCopied(success);
    }
  }
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
      {createdMatchup && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-[#101525]/70 p-3 backdrop-blur-sm sm:p-6">
        <div role="dialog" aria-modal="true" aria-labelledby="discord-share-heading" className="my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-[#5865F2]/25 bg-gradient-to-br from-[#f4f5ff] via-white to-[#f0f1ff] shadow-[0_16px_45px_rgba(39,49,120,0.12)]">
          <div className="flex items-start gap-3 border-b border-[#5865F2]/15 bg-[#5865F2]/[0.07] p-4 sm:p-5">
            <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#5865F2] text-white">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M19.73 5.36a18.2 18.2 0 0 0-4.48-1.39l-.22.45a16.8 16.8 0 0 0-6.06 0l-.22-.45a18.2 18.2 0 0 0-4.48 1.39C1.44 9.55.67 13.63 1.05 17.65a18.4 18.4 0 0 0 5.5 2.78l1.19-1.94a11.8 11.8 0 0 1-1.87-.91l.46-.36c3.61 1.67 7.53 1.67 11.1 0l.47.36c-.6.36-1.23.66-1.88.91l1.19 1.94a18.4 18.4 0 0 0 5.5-2.78c.45-4.66-.77-8.7-2.98-12.29ZM8.55 15.3c-1.08 0-1.97-.99-1.97-2.2 0-1.22.87-2.21 1.97-2.21s1.99.99 1.97 2.21c0 1.21-.87 2.2-1.97 2.2Zm6.9 0c-1.08 0-1.97-.99-1.97-2.2 0-1.22.87-2.21 1.97-2.21s1.99.99 1.97 2.21c0 1.21-.87 2.2-1.97 2.2Z"/></svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5865F2]">Matchup published</p>
              <h3 id="discord-share-heading" className="mt-1 text-xl font-black tracking-tight text-[#172033]">Now bring the debate to Discord.</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#626b7b]">Share your matchup with the Duelio community and invite people to vote. Copy this ready-to-post message.</p>
            </div>
            <button type="button" onClick={() => setCreatedMatchup(null)} aria-label="Dismiss Discord sharing prompt" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg text-[#626b7b] hover:bg-[#5865F2]/10">×</button>
          </div>
          <div className="p-4 sm:p-5">
            <div className="whitespace-pre-wrap rounded-xl border border-[#dfe2f4] bg-white p-4 text-sm leading-relaxed text-[#29334a]">{discordMessage}</div>
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
              <button type="button" onClick={copyDiscordMessage} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#4752c4]">
                {copied ? '✓ Copied — ready to paste' : '▢ Copy Discord message'}
              </button>
              <a href="https://discord.gg/yyqm6gPWnS" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#d8dcf1] bg-white px-4 py-3 text-sm font-extrabold text-[#29334a] transition hover:bg-[#f4f5ff]">
                Join the Discord <span aria-hidden="true">↗</span>
              </a>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[#737c90]">After joining, paste it into the matchup-sharing channel. The link takes people straight to your matchup.</p>
          </div>
        </div>
        </div>
      )}
      <p className="mt-3 text-xs text-mute">Same two names, either order? Duelio takes you to the same canonical matchup.</p>
    </Wrapper>
  );
}
