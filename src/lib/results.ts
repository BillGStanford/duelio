import type { Counts, Dilemma, Results } from './types';

export function computeResults(counts: Counts): Results {
  const total = counts.a + counts.b;
  if (total === 0) return { a: 0, b: 0, total: 0, pctA: 50, pctB: 50 };
  const pctA = Math.round((counts.a / total) * 100);
  return { a: counts.a, b: counts.b, total, pctA, pctB: 100 - pctA };
}

export function isDeadHeat(counts: Counts, minimumVotes = 10): boolean {
  const results = computeResults(counts);
  return results.total >= minimumVotes && results.pctA >= 45 && results.pctA <= 55;
}

export function isHot(counts: Counts, minimumVotes = 10): boolean {
  return counts.a + counts.b >= minimumVotes;
}

export function isClosed(d: Pick<Dilemma, 'closesAt'>, now: Date = new Date()): boolean {
  return !!d.closesAt && new Date(d.closesAt).getTime() <= now.getTime();
}

/** Returns the label the crowd picked, or null for a tie / no votes. */
export function winnerLabel(
  r: Results,
  d: Pick<Dilemma, 'sideALabel' | 'sideBLabel'>,
): string | null {
  if (r.total === 0 || r.a === r.b) return null;
  return r.a > r.b ? d.sideALabel : d.sideBLabel;
}

export function verdictLine(
  r: Results,
  d: Pick<Dilemma, 'sideALabel' | 'sideBLabel'>,
): string {
  if (r.total === 0) return 'Nobody picked a side.';
  const w = winnerLabel(r, d);
  return w ? `The crowd picked ${w}.` : 'The crowd is split down the middle.';
}
