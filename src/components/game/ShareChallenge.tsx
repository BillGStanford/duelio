'use client';

import { useState } from 'react';
import type { Featured } from '@/lib/wikirush/featured';

/** Share a Day N Challenge link (native share sheet when available, else copy). */
export default function ShareChallenge({ f, className = 'gx-btn gx-btn-ghost gx-btn-sm' }: { f: Featured; className?: string }) {
  const [done, setDone] = useState(false);
  async function share() {
    const link = `${window.location.origin}/wikirush?f=${encodeURIComponent(f.id)}#feat-${f.id}`;
    const text = `${f.day ? `Day ${f.day} Challenge` : 'WikiRush challenge'}: ${f.pairs[0].start} → ${f.pairs[0].target}${f.pairs.length > 1 ? ` +${f.pairs.length - 1} more` : ''}. Can you beat my score?`;
    try { if (navigator.share) { await navigator.share({ title: 'WikiRush', text, url: link }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(`${text} ${link}`); } catch { window.prompt('Copy this link', link); }
    setDone(true); window.setTimeout(() => setDone(false), 2000);
  }
  return <button type="button" onClick={share} className={className}>{done ? 'Link copied ✓' : '↗ Share'}</button>;
}
