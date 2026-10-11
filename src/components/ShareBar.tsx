'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { track } from '@/lib/analytics';
import { newRoomCode } from '@/lib/room';
import { shareCopy, SHARE_COPY_VARIANTS, type ShareCopyVariant } from '@/lib/shareCopy';
import type { Results, Side } from '@/lib/types';

const VARIANT_STORAGE_KEY = 'duelio-share-copy-v1';

function getCopyVariant(): ShareCopyVariant {
  try {
    const saved = localStorage.getItem(VARIANT_STORAGE_KEY);
    if (SHARE_COPY_VARIANTS.includes(saved as ShareCopyVariant)) return saved as ShareCopyVariant;
    const variant = SHARE_COPY_VARIANTS[Math.floor(Math.random() * SHARE_COPY_VARIANTS.length)];
    localStorage.setItem(VARIANT_STORAGE_KEY, variant);
    return variant;
  } catch {
    return SHARE_COPY_VARIANTS[Math.floor(Math.random() * SHARE_COPY_VARIANTS.length)];
  }
}

export default function ShareBar({
  slug,
  question,
  room,
  side,
  labelA,
  labelB,
  results,
}: {
  slug: string;
  question: string;
  room: string | null;
  side: Side | null;
  labelA: string;
  labelB: string;
  results: Results;
}) {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [manualMessage, setManualMessage] = useState('');

  async function copyMessage(message: string, link: string) {
    const fullMessage = `${message} ${link}`;
    try {
      await navigator.clipboard.writeText(fullMessage);
      setStatus('Chat message copied. Paste it to the person you had in mind.');
      return true;
    } catch {
      setManualMessage(fullMessage);
      setStatus('Copy didn’t work here. Select the message below and copy it.');
      return false;
    }
  }

  async function sendToSomeone() {
    const variant = getCopyVariant();
    const code = room ?? newRoomCode();
    const link = `${window.location.origin}/d/${slug}?g=${code}`;
    const message = shareCopy(variant, question, side, labelA, labelB, results);
    const variantProps = { slug, copyVariant: variant };

    track('share_clicked', { ...variantProps, method: 'group' });
    track(`share_copy_${variant}_started`);
    if (!room) track('group_created', { slug, method: 'group' });

    let nativeShare: Promise<void> | null = null;
    if (typeof navigator.share === 'function') {
      try {
        nativeShare = navigator.share({ title: question, text: message, url: link });
      } catch {
        nativeShare = null;
      }
    }

    const attachVote = room
      ? Promise.resolve()
      : fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, room: code }),
        }).then(async (response) => {
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error || 'We couldn’t add your vote to the group yet.');
          }
        }).catch((error: unknown) => error instanceof Error ? error : new Error('We couldn’t add your vote to the group yet.'));

    if (nativeShare) {
      try {
        await nativeShare;
        track('share_completed', { ...variantProps, method: 'group-native' });
        track(`share_copy_${variant}_completed`);
        setStatus('Sent. Keep this page open to see votes come in.');
      } catch (error) {
        setManualMessage(`${message} ${link}`);
        setStatus((error as Error)?.name === 'AbortError'
          ? 'Share cancelled. You can still copy the group message below.'
          : 'Could not open the share sheet. Copy the group message below instead.');
      }
    } else {
      const copied = await copyMessage(message, link);
      if (copied) {
        track('share_completed', { ...variantProps, method: 'group-copy' });
        track(`share_copy_${variant}_completed`);
      }
    }

    const attachError = await attachVote;
    if (attachError instanceof Error) {
      setStatus(attachError.message);
      return;
    }
    if (!room) router.replace(`/d/${slug}?g=${code}`, { scroll: false });
  }

  async function copyLink() {
    const link = room
      ? `${window.location.origin}/d/${slug}?g=${room}`
      : `${window.location.origin}/d/${slug}`;
    try {
      await navigator.clipboard.writeText(link);
      setStatus('Link copied.');
    } catch {
      setManualMessage(link);
      setStatus('Copy didn’t work here. Select the link below and copy it.');
    }
  }

  return (
    <section aria-labelledby="share-heading" className="mt-6 border-l-8 border-sidea bg-white p-5 sm:p-6">
      <h3 id="share-heading" className="text-2xl font-extrabold tracking-tight">Your result is in. Who did you have in mind?</h3>
      <p className="mt-1 text-mute">Send this to the person you argue with about this. Their vote joins your private group tally.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={sendToSomeone} className="min-h-12 bg-ink px-5 py-3 text-lg font-bold text-white hover:bg-sidea">
          Send to the person you argue with
        </button>
        <button type="button" onClick={copyLink} className="min-h-11 border-2 border-ink px-4 py-2 text-sm font-bold hover:bg-[#f2f3ff]">
          Copy link
        </button>
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-sm font-semibold">{status}</p>
      {manualMessage && (
        <label className="mt-2 block text-sm font-bold">
          Message and group link
          <textarea
            readOnly
            rows={3}
            value={manualMessage}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-1 w-full border-2 border-ink bg-[#f2f3ff] p-3 font-normal"
          />
        </label>
      )}
    </section>
  );
}
