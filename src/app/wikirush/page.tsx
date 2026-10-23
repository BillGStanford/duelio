import type { Metadata } from 'next';
import WikiRush from '@/components/WikiRush';

const title = 'WikiRush: GeoGuessr for Wikipedia';
const description = 'Race from one Wikipedia page to another using only links. Daily challenge, shareable seeds, and a one-tap recorder that makes a post-ready video.';

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
