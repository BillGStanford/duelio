export function resolveSiteUrl(configuredUrl: string | undefined, deploymentHost: string | undefined, onVercel: boolean): string {
  const configured = configuredUrl?.trim().replace(/\/+$/, '');
  if (configured) {
    const hostname = new URL(configured).hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    if (!onVercel || !isLocalhost) return configured;
  }

  const host = deploymentHost?.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return host ? `https://${host}` : 'http://localhost:3000';
}

export const SITE_URL = resolveSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL,
  !!process.env.VERCEL,
);
export const THREADLINE_HOME = 'https://www.threadline.ink';

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
export function countWord(n: number): string {
  return n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
}

export function formatCloseDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}
