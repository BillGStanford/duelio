'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { track } from '@/lib/analytics';
import { newRoomCode } from '@/lib/room';

export default function ShareBar({ slug, question, room }: { slug: string; question: string; room: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState('');

  async function copy(text: string, ok: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(ok);
      return true;
    } catch {
      setStatus(`Copy this link: ${text}`);
      return false;
    }
  }

  async function groupChat() {
    const code = room ?? newRoomCode();
    const link = `${window.location.origin}/d/${slug}?g=${code}`;
    track(room ? 'share_clicked' : 'group_created', { slug, method: 'group' });
    if (!room) {
      // If the creator already voted, count that vote toward the new group. Ignored if they haven't voted yet.
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, room: code }),
      }).catch(() => undefined);
      router.replace(`/d/${slug}?g=${code}`, { scroll: false });
    }
    const text = `Group chat verdict pending: ${question} Vote before you see what everyone else said.`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Group chat verdict pending', text, url: link });
        track('share_completed', { slug, method: 'group-native' });
        return;
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
      }
    }
    if (await copy(link, 'Group link copied. Paste it in the chat.')) track('share_completed', { slug, method: 'group-copy' });
  }

  async function plain() {
    track('share_clicked', { slug, method: 'copy' });
    if (await copy(`${window.location.origin}/d/${slug}`, 'Link copied.')) track('share_completed', { slug, method: 'copy' });
  }

  return (
    <div className="mt-8 border-t-4 border-ink pt-5">
      <p className="text-2xl font-extrabold tracking-tight">Settle it in your group chat.</p>
      <p className="mt-1 text-mute">One link. Everyone votes. The group&apos;s own split shows up here, live.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={groupChat} className="bg-ink px-5 py-3 text-lg font-bold text-white hover:bg-sidea">
          Settle it in your group chat
        </button>
        <button type="button" onClick={plain} className="border-2 border-ink px-5 py-3 font-bold hover:bg-white">
          Copy plain link
        </button>
        <span role="status" className="text-sm font-medium">{status}</span>
      </div>
    </div>
  );
}
