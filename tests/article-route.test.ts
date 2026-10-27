import { describe, expect, it, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/wikirush/article/route';

const page = '<html><body><section><p>Hi <a href="./Mars" rel="mw:WikiLink">Mars</a></p></section></body></html>';
const req = (t: string, bg = false) => new NextRequest(`http://x/api/wikirush/article?title=${t}`, { headers: bg ? { 'x-wr-prefetch': '1' } : {} });

afterEach(() => vi.unstubAllGlobals());

describe('article route resilience', () => {
  it('retries through throttling and falls back to the second endpoint', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url);
      if (calls.length <= 2) return new Response('slow down', { status: 429, headers: { 'retry-after': '0' } });
      return Object.defineProperty(new Response(page, { status: 200 }), 'url', { value: 'https://en.wikipedia.org/api/rest_v1/page/html/Resilient_One' });
    }));
    const res = await GET(req('Resilient_One'));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { html: string }).html).toContain('Mars');
    expect(calls.some(u => u.includes('rest_v1'))).toBe(true);
  });

  it('reports 404 only when both endpoints agree', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 404 })));
    expect((await GET(req('Nothing_Here_Xyz'))).status).toBe(404);
  });
});
