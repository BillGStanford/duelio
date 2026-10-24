import { pageCard } from '@/lib/cards';

export const runtime = 'nodejs';
export const alt = 'WikiRush by Duelio: the Wikipedia link race game';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return pageCard({
    fmt: 'wide',
    question: 'Race Wikipedia. Beat the clock.',
    labelA: 'WikiRush',
    labelB: 'Duelio',
  });
}
