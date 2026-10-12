'use client';
import { useEffect, useState } from 'react';

export default function EntityImage({ src, name, className = '' }: { src?: string | null; name: string; className?: string }) {
  const fallback = `/api/entity-image?name=${encodeURIComponent(name)}`;
  const [current, setCurrent] = useState(src || fallback);
  useEffect(() => setCurrent(src || fallback), [src, name]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={current} alt={name} loading="lazy" onError={() => { if (current !== fallback) setCurrent(fallback); }}
      className={className} style={{ objectFit: 'contain', objectPosition: 'center' }} />
  );
}
