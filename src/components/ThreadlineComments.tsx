'use client';
import { useState } from 'react';
import Script from 'next/script';
import { track } from '@/lib/analytics';
import { resolveThreadlineApiUrl } from '@/lib/site';

const SITE_ID = process.env.NEXT_PUBLIC_THREADLINE_SITE_ID;
const API_URL = process.env.NEXT_PUBLIC_THREADLINE_API_URL
  ? resolveThreadlineApiUrl(process.env.NEXT_PUBLIC_THREADLINE_API_URL)
  : null;
const EMBED_SRC = process.env.NEXT_PUBLIC_THREADLINE_EMBED_SRC;

/**
 * Threadline discussion embed. All three values come from environment variables.
 * The script id includes the slug so Next.js re-runs the embed when a visitor
 * moves from one dilemma to another without a full page load.
 */
export default function ThreadlineComments({ slug }: { slug: string }) {
  const [failed, setFailed] = useState(false);

  if (!SITE_ID || !API_URL || !EMBED_SRC || failed) {
    return (
      <p role="status" className="border-l-4 border-ink bg-white px-3 py-2">
        The discussion is unavailable right now. Your vote still counts. Reload the page to try again.
      </p>
    );
  }

  return (
    <>
      <div id="threadline-comments" />
      <Script
        id={`threadline-embed-${slug}`}
        src={EMBED_SRC}
        data-site-id={SITE_ID}
        data-api-url={API_URL}
        strategy="afterInteractive"
        onLoad={() => track('discussion_loaded', { slug })}
        onError={() => setFailed(true)}
      />
    </>
  );
}
