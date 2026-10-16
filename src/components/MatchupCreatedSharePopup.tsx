'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type ShareData = { a: string; b: string; url: string };

const STORAGE_KEY = 'duelio-pending-discord-share-v1';

export default function MatchupCreatedSharePopup() {
  const pathname = usePathname();
  const [matchup, setMatchup] = useState<ShareData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Only show after the user has landed on the newly-created voting page.
    if (!pathname?.startsWith('/matchup/')) return;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ShareData;
      if (!parsed?.a || !parsed?.b || !parsed?.url) return;
      setMatchup(parsed);
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // If storage is unavailable, do not block the voting page.
    }
  }, [pathname]);

  if (!matchup) return null;

  const message = `🔥 I just created a new Duelio matchup: ${matchup.a} vs. ${matchup.b}\n\nCast your vote and join the debate: ${matchup.url}\n\nWho do you think should win? Tell us why!`;

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      const area = document.createElement('textarea');
      area.value = message;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      setCopied(document.execCommand('copy'));
      area.remove();
    }
  }

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center overflow-y-auto bg-[#101525]/70 p-3 backdrop-blur-sm sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) setMatchup(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="discord-share-heading" className="my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-[#5865F2]/25 bg-gradient-to-br from-[#f4f5ff] via-white to-[#f0f1ff] shadow-2xl">
        <div className="flex items-start gap-3 border-b border-[#5865F2]/15 bg-[#5865F2]/[0.07] p-4 sm:p-5">
          <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#5865F2] text-white text-xl font-black">D</span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5865F2]">Your voting page is ready</p>
            <h2 id="discord-share-heading" className="mt-1 text-xl font-black tracking-tight text-[#172033]">Now bring the debate to Discord.</h2>
            <p className="mt-1 text-sm leading-relaxed text-[#626b7b]">Your matchup has been published. Share it with the Duelio community and invite people to vote.</p>
          </div>
          <button type="button" onClick={() => setMatchup(null)} aria-label="Dismiss Discord sharing prompt" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg text-[#626b7b] hover:bg-[#5865F2]/10">×</button>
        </div>
        <div className="p-4 sm:p-5">
          <div className="whitespace-pre-wrap rounded-xl border border-[#dfe2f4] bg-white p-4 text-sm leading-relaxed text-[#29334a]">{message}</div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <button type="button" onClick={copyMessage} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#5865F2] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#4752c4]">{copied ? '✓ Copied — ready to paste' : '▢ Copy Discord message'}</button>
            <a href="https://discord.gg/yyqm6gPWnS" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#d8dcf1] bg-white px-4 py-3 text-sm font-extrabold text-[#29334a] transition hover:bg-[#f4f5ff]">Join the Discord <span aria-hidden="true">↗</span></a>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#737c90]">You’re already on your matchup’s voting page. Copy the message, join Discord, and paste it into the matchup-sharing channel.</p>
        </div>
      </section>
    </div>
  );
}
