import { pageCard } from '@/lib/cards';

export const runtime = 'nodejs';
export const alt = 'Duelio: dilemmas, matchups, and public opinion';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return pageCard({
    fmt: 'wide',
    question: 'Every debate has two sides.',
    labelA: 'Dilemmas',
    labelB: 'Matchups',
  });
}
