'use client';
import { useId, useState } from 'react';
import { track } from '@/lib/analytics';
import { shareImage } from '@/lib/shareImage';

type Fmt = 'story' | 'portrait' | 'square' | 'wide';

const FORMATS: { id: Fmt; label: string; ratio: string; where: string; w: number; h: number }[] = [
  { id: 'story', label: 'Story', ratio: '9:16', where: 'Instagram, TikTok, Reels, WhatsApp status', w: 1080, h: 1920 },
  { id: 'portrait', label: 'Feed post', ratio: '4:5', where: 'Instagram and Facebook feed', w: 1080, h: 1350 },
  { id: 'square', label: 'Square', ratio: '1:1', where: 'iMessage, WhatsApp, any post', w: 1080, h: 1080 },
  { id: 'wide', label: 'Link card', ratio: '1.91:1', where: 'X, Facebook, LinkedIn', w: 1200, h: 630 },
];

const PREVIEW_MAX: Record<Fmt, string> = {
  story: 'max-w-[220px]',
  portrait: 'max-w-[300px]',
  square: 'max-w-[340px]',
  wide: 'max-w-full',
};

interface Props {
  /** Builds the image URL for a format, e.g. (f) => `/card/slug/a?fmt=${f}` */
  src: (fmt: Fmt) => string;
  filename: string;
  shareText: string;
  alt: string;
  event: 'card_shared' | 'take_shared';
  slug?: string;
  defaultFmt?: Fmt;
}

export default function CardShare({ src, filename, shareText, alt, event, slug, defaultFmt = 'square' }: Props) {
  const [fmt, setFmt] = useState<Fmt>(defaultFmt);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const group = useId();
  const cur = FORMATS.find((f) => f.id === fmt)!;

  async function share() {
    setBusy(true);
    setNote('');
    track(event, slug ? { slug, fmt } : { fmt });
    try {
      const r = await shareImage(src(fmt), `${filename}-${fmt}.png`, { text: shareText, link: window.location.href.split('?')[0] });
      if (r === 'downloaded') setNote('Saved to your device. Post it anywhere.');
    } catch {
      setNote('We couldn\u2019t make the card. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <fieldset className="mt-4">
        <legend className="text-sm font-bold">Pick a size</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <label
              key={f.id}
              className={`cursor-pointer border-2 border-ink px-3 py-2 text-sm font-bold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 ${
                fmt === f.id ? 'bg-ink text-white' : 'bg-white hover:bg-paper'
              }`}
            >
              <input type="radio" name={group} value={f.id} checked={fmt === f.id} onChange={() => setFmt(f.id)} className="sr-only" />
              {f.label} <span className="font-normal">{f.ratio}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm text-mute">{cur.where}</p>
      </fieldset>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={fmt}
        src={src(fmt)}
        width={cur.w}
        height={cur.h}
        alt={alt}
        loading="lazy"
        style={{ aspectRatio: `${cur.w} / ${cur.h}` }}
        className={`mt-4 w-full ${PREVIEW_MAX[fmt]} border-2 border-ink bg-white`}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy} onClick={share} className="bg-ink px-5 py-3 font-bold text-white hover:bg-sidea disabled:opacity-60">
          {busy ? 'Making your card' : 'Share this card'}
        </button>
        <span role="status" className="text-sm font-medium">{note}</span>
      </div>
      <p className="mt-2 text-sm text-mute">On phones this opens your share sheet with the image attached. On a computer it saves the image.</p>
    </div>
  );
}
