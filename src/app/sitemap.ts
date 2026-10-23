import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { getStore } from '@/lib/store';
import { listMatchups } from '@/lib/matchups';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let dilemmas: Awaited<ReturnType<ReturnType<typeof getStore>['listDilemmas']>> = [];
  try {
    dilemmas = await getStore().listDilemmas({ status: 'published' });
  } catch {
    /* sitemap still lists static pages */
  }
  const matchups = await listMatchups(1000);
  return [
    { url: `${SITE_URL}/` },
    { url: `${SITE_URL}/wikirush`, priority: 1.0, changeFrequency: 'daily' },
    { url: `${SITE_URL}/leaderboard`, priority: 0.7, changeFrequency: 'hourly' },
    { url: `${SITE_URL}/matchups`, priority: 0.6, changeFrequency: 'daily' },
    { url: `${SITE_URL}/submit` },
    { url: `${SITE_URL}/guidelines` },
    ...dilemmas.map((d) => ({ url: `${SITE_URL}/d/${d.slug}`, lastModified: d.updatedAt })),
    ...matchups.map((m) => ({ url: `${SITE_URL}/matchup/${m.slug}`, lastModified: m.createdAt })),
  ];
}
