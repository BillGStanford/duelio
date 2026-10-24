import { NextResponse } from 'next/server';
import { listFeatured } from '@/lib/wikirush/featuredStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const list = await listFeatured({ activeOnly: true });
    return NextResponse.json({ featured: list.slice(0, 12) }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } });
  } catch {
    return NextResponse.json({ featured: [] });
  }
}
