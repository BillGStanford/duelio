type Props = Record<string, string | number | boolean>;

/**
 * Tiny analytics adapter. Events go to /api/events (stored in your own database,
 * shown on /admin) and, if a Google Tag Manager style dataLayer exists on the page,
 * are mirrored there so a provider can be connected later without touching components.
 */
export function track(name: string, props: Props = {}): void {
  if (typeof window === 'undefined') return;
  try {
    const body = JSON.stringify({ name, props });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
    } else {
      void fetch('/api/events', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
    }
    const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
    if (Array.isArray(dl)) dl.push({ event: name, ...props });
  } catch {
    /* never break the UI over analytics */
  }
}
