import { describe, expect, it } from 'vitest';
import { resolveSiteUrl, resolveThreadlineApiUrl } from '@/lib/site';

describe('site URL', () => {
  it('prefers an explicitly configured public domain', () => {
    expect(resolveSiteUrl('https://duelio.live/', 'duelio-five.vercel.app', true)).toBe('https://duelio.live');
  });

  describe('Threadline API URL', () => {
    it('replaces the redirecting Threadline site host with its API host', () => {
      expect(resolveThreadlineApiUrl('https://threadline.ink/api/')).toBe('https://api.threadline.ink');
      expect(resolveThreadlineApiUrl('https://www.threadline.ink/api')).toBe('https://api.threadline.ink');
    });

    it('preserves an already-canonical API URL', () => {
      expect(resolveThreadlineApiUrl('https://api.threadline.ink/')).toBe('https://api.threadline.ink');
    });

    it('rejects a malformed API URL', () => {
      expect(resolveThreadlineApiUrl('not a URL')).toBeNull();
    });
  });

  it('uses the Duelio custom domain when no public URL is configured on Vercel', () => {
    expect(resolveSiteUrl(undefined, 'duelio-five.vercel.app', true)).toBe('https://duelio.ink');
  });

  it('ignores localhost and forces HTTPS for the configured Vercel URL', () => {
    expect(resolveSiteUrl('http://localhost:3000', 'duelio-five.vercel.app', true)).toBe(
      'https://duelio.ink',
    );
    expect(resolveSiteUrl('http://duelio.ink', 'duelio-five.vercel.app', true)).toBe('https://duelio.ink');
  });

  it('keeps localhost for local development without a deployment host', () => {
    expect(resolveSiteUrl(undefined, undefined, false)).toBe('http://localhost:3000');
  });
});
