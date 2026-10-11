import type { Results, Side } from './types';

export const SHARE_COPY_VARIANTS = ['a', 'b', 'c'] as const;
export type ShareCopyVariant = (typeof SHARE_COPY_VARIANTS)[number];

export function shareCopy(
  variant: ShareCopyVariant,
  question: string,
  side: Side | null,
  labelA: string,
  labelB: string,
  results: Results,
): string {
  if (!side) return `I’m curious where you land on this: ${question} Pick a side:`;

  const label = side === 'a' ? labelA : labelB;
  const otherLabel = side === 'a' ? labelB : labelA;
  const agreePct = side === 'a' ? results.pctA : results.pctB;
  const disagreePct = 100 - agreePct;

  switch (variant) {
    case 'a':
      return `I picked ${label}, but only ${agreePct}% agree with me. Prove me wrong:`;
    case 'b':
      return `I picked ${label}. ${disagreePct}% picked ${otherLabel}. Is the crowd right?`;
    case 'c':
      return `I picked ${label}, and the vote is ${agreePct}%–${disagreePct}%. What would you choose?`;
  }
}
