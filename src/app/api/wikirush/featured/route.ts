import { NextResponse } from 'next/server';
import { listFeatured } from '@/lib/wikirush/featuredStore';
import { previewPair } from '@/lib/wikirush/thumbs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const list = (await listFeatured({ activeOnly: true })).slice(0, 12);
    const featured = await Promise.all(list.map(async f => ({ ...f, preview: await previewPair(f.pairs[0].start, f.pairs[0].target) })));
    return NextResponse.json({ featured }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } });
  } catch {
    return NextResponse.json({ featured: [] });
  }
}
