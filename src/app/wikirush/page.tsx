import type { Metadata } from 'next';
import WikiRush from '@/components/WikiRush';

export const metadata: Metadata = {
  title: 'WikiRush — Race through Wikipedia',
  description: 'Race across Wikipedia pages before the clock runs out. Explore, connect, and conquer with WikiRush by Duelio.',
};

export default function WikiRushPage() {
  return <WikiRush />;
}
