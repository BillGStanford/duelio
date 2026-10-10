export type ShareImageResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Fetches a generated PNG and hands it to the native share sheet as a file
 * (works on most phones). Falls back to downloading it.
 */
export async function shareImage(
  imageUrl: string,
  filename: string,
  opts: { text: string; link?: string },
): Promise<ShareImageResult> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error('image failed');
  const blob = await res.blob();
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: opts.text, url: opts.link });
      return 'shared';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}
