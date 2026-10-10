import Link from 'next/link';
import type { Dilemma } from '@/lib/types';

export default function DuelStrip({
  d,
  total,
  closed,
  deadHeat = false,
}: {
  d: Dilemma;
  total: number;
  closed: boolean;
  deadHeat?: boolean;
}) {
  return (
    <article className="border-t-4 border-ink py-8 sm:py-10">
      <h3 className="max-w-3xl text-[1.65rem] font-extrabold leading-[1.1] tracking-[-0.02em] sm:text-4xl">
        <Link href={`/d/${d.slug}`} className="hover:underline decoration-4 underline-offset-4">
          {d.question}
        </Link>
      </h3>
      {deadHeat && (
        <p className="mt-3 inline-block bg-rule px-3 py-1 text-sm font-extrabold uppercase tracking-wide">
          Dead heat · 45–55%
        </p>
      )}
      <div className="mt-6 grid sm:grid-cols-2">
        <div className="bg-sidea p-4 text-white sm:p-5">
          <p className="flex items-center gap-2 text-lg font-bold">
            <span aria-hidden="true" className="grid h-6 w-6 place-items-center bg-white text-sm font-extrabold text-sidea">A</span>
            {d.sideALabel}
          </p>
          <p className="mt-1 text-[0.95rem] leading-snug">{d.sideADescription}</p>
        </div>
        <div className="bg-sideb p-4 text-white sm:p-5">
          <p className="flex items-center gap-2 text-lg font-bold">
            <span aria-hidden="true" className="grid h-6 w-6 place-items-center bg-white text-sm font-extrabold text-sideb">B</span>
            {d.sideBLabel}
          </p>
          <p className="mt-1 text-[0.95rem] leading-snug">{d.sideBDescription}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.95rem] text-mute">
          {closed ? 'The vote is in. ' : ''}
          {total === 0 ? 'Nobody has picked a side yet.' : `${total} ${total === 1 ? 'vote' : 'votes'}`}
        </p>
        <Link
          href={`/d/${d.slug}`}
          className="bg-ink px-5 py-3 text-base font-bold text-white hover:bg-sidea"
          aria-label={`View debate: ${d.question}`}
        >
          View debate
        </Link>
      </div>
    </article>
  );
}
