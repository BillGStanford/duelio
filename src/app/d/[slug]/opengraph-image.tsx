import { pageCard, resultCard } from '@/lib/cards';
import { computeResults } from '@/lib/results';
import { getStore } from '@/lib/store';
import { isValidSlug } from '@/lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'A Duelio dilemma';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { slug: string } }) {
  const d = isValidSlug(params.slug) ? await getStore().getDilemmaBySlug(params.slug) : null;
  const ok = d && d.status === 'published';
  if (ok) {
    const counts = (await getStore().getCounts([d.id]))[d.id];
    const results = computeResults(counts);
    return resultCard({
      question: d.question,
      labelA: d.sideALabel,
      labelB: d.sideBLabel,
      pctA: results.pctA,
      pctB: results.pctB,
      total: results.total,
    });
  }
  return pageCard({
    fmt: 'wide',
    question: 'The internet disagrees with you.',
    labelA: 'Pick',
    labelB: 'a side',
  });
}
