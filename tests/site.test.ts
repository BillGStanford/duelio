import { describe, expect, it } from 'vitest';
import { resolveSiteUrl } from '@/lib/site';

describe('site URL', () => {
  it('prefers an explicitly configured public domain', () => {
    expect(resolveSiteUrl('https://duelio.ink/', 'duelio-five.vercel.app', true)).toBe('https://duelio.ink');
  });

  it('uses the Vercel production host when no public URL is configured', () => {
    expect(resolveSiteUrl(undefined, 'duelio-five.vercel.app', true)).toBe('https://duelio-five.vercel.app');
  });

  it('ignores a localhost URL accidentally configured in Vercel', () => {
    expect(resolveSiteUrl('http://localhost:3000', 'duelio-five.vercel.app', true)).toBe(
      'https://duelio-five.vercel.app',
    );
  });

  it('keeps localhost for local development without a deployment host', () => {
    expect(resolveSiteUrl(undefined, undefined, false)).toBe('http://localhost:3000');
  });
});
