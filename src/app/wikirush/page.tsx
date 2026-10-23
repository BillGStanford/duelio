import type { Metadata } from 'next';
import WikiRush from '@/components/WikiRush';

const title = 'WikiRush — The Wikipedia Speedrun Game | GeoGuessr for Wikipedia';
const description = 'Play WikiRush, the Wikipedia speedrun game: race from a real Wikipedia article to a target using only clickable links. Try the daily challenge, challenge friends, climb the leaderboard, and share your run.';

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title, description, type: 'website', siteName: 'Duelio',
    images: [{ url: '/wikirush/wr-og.png', width: 1200, height: 630, alt: 'WikiRush by Duelio: GeoGuessr for Wikipedia' }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/wikirush/wr-og.png'] },
};

export default function WikiRushPage() {
  return <WikiRush />;
}
