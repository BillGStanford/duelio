import type { Metadata } from 'next';
import WikiRush from '@/components/WikiRush';
import JsonLd from '@/components/wikirush/JsonLd';
import SeoContent from '@/components/wikirush/SeoContent';
import { listFeatured } from '@/lib/wikirush/featuredStore';
import { teaserFor } from '@/lib/wikirush/featured';
import { parseChallengeParams } from '@/lib/wikirush/share';
import { WR_DESCRIPTION, WR_KEYWORDS, WR_TITLE, faqJsonLd, gameJsonLd } from '@/lib/wikirush/seo';

const base: Metadata = {
  title: { absolute: WR_TITLE },
  description: WR_DESCRIPTION,
  keywords: WR_KEYWORDS,
  alternates: { canonical: '/wikirush' },
  openGraph: {
    title: WR_TITLE, description: WR_DESCRIPTION, type: 'website', siteName: 'Duelio', url: '/wikirush',
    images: [{ url: '/game/og.png', width: 1200, height: 630, alt: 'WikiRush by Duelio: the Wikipedia link race game' }],
  },
  twitter: { card: 'summary_large_image', title: WR_TITLE, description: WR_DESCRIPTION, images: ['/game/og.png'] },
};

export async function generateMetadata({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }): Promise<Metadata> {
  const fid = typeof searchParams?.f === 'string' ? searchParams.f.replace(/[^a-z0-9-]/gi, '').slice(0, 40) : '';
  if (fid) {
    const f = (await listFeatured({}).catch(() => [])).find(x => x.id === fid);
    if (f) {
      const p = f.pairs[0];
      const t = `${f.day ? `Day ${f.day} Challenge` : 'WikiRush challenge'}: ${p.start} → ${p.target}${f.pairs.length > 1 ? ` +${f.pairs.length - 1} more` : ''}`;
      const d = teaserFor(f);
      const img = `/wikirush/challenge-og?f=${encodeURIComponent(f.id)}`;
      return {
        title: { absolute: `${t} | WikiRush` }, description: d, robots: { index: false, follow: true },
        openGraph: { title: t, description: d, type: 'website', siteName: 'Duelio', images: [{ url: img, width: 1200, height: 630, alt: t }] },
        twitter: { card: 'summary_large_image', title: t, description: d, images: [img] },
      };
    }
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams || {})) if (typeof v === 'string') qs.set(k, v);
  const c = parseChallengeParams(`?${qs.toString()}`);
  if (!c) return base;
  const who = c.name ? `${c.name} scored` : 'A friend scored';
  const t = c.score !== undefined ? `${who} ${c.score.toLocaleString('en-US')} on WikiRush. Can you beat it?` : 'Take the WikiRush challenge: same pages, your turn.';
  const img = `/wikirush/og?r=${c.rounds}${c.score !== undefined ? `&s=${c.score}` : ''}${c.name ? `&n=${encodeURIComponent(c.name)}` : ''}`;
  return {
    title: { absolute: t }, robots: { index: false, follow: true },
    openGraph: { title: t, description: WR_DESCRIPTION, type: 'website', siteName: 'Duelio', images: [{ url: img, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: t, description: WR_DESCRIPTION, images: [img] },
  };
}

export default function WikiRushPage() {
  return <>
    <JsonLd data={gameJsonLd()} />
    <JsonLd data={faqJsonLd()} />
    <WikiRush />
    <SeoContent />
  </>;
}
