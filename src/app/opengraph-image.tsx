import { pageCard } from '@/lib/cards';

export const runtime = 'nodejs';
export const alt = 'Duelio: pick a side on everyday dilemmas';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return pageCard({
    fmt: 'wide',
    question: 'The internet disagrees with you.',
    labelA: 'Pick a side',
    labelB: 'Make your case',
  });
}
