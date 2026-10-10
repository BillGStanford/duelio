import { pageCard } from '@/lib/cards';
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
  return pageCard({
    fmt: 'wide',
    question: ok ? d.question : 'The internet disagrees with you.',
    labelA: ok ? d.sideALabel : 'Pick',
    labelB: ok ? d.sideBLabel : 'a side',
  });
}
