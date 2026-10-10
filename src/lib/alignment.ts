import type { Counts, Side } from './types';

/** A debate only counts toward your take once at least this many people have voted. */
export const MIN_TOTAL_VOTES = 3;
/** You need this many counted debates before a take is shown. */
export const MIN_DEBATES = 3;

export interface Take {
  considered: number;
  withCrowd: number;
  pct: number | null;
  label: string | null;
  unlockIn: number;
}

export function takeLabel(pct: number): string {
  if (pct >= 80) return 'You and the crowd are basically the same person';
  if (pct >= 60) return 'Mostly with the crowd';
  if (pct >= 40) return 'A coin flip';
  if (pct >= 20) return 'Mostly against the crowd';
  return 'Certified contrarian';
}

export function computeTake(history: { dilemmaId: string; side: Side }[], counts: Record<string, Counts>): Take {
  let considered = 0;
  let withCrowd = 0;
  for (const h of history) {
    const c = counts[h.dilemmaId];
    if (!c) continue;
    if (c.a + c.b < MIN_TOTAL_VOTES || c.a === c.b) continue;
    considered += 1;
    if (h.side === (c.a > c.b ? 'a' : 'b')) withCrowd += 1;
  }
  const unlockIn = Math.max(0, MIN_DEBATES - considered);
  if (unlockIn > 0) return { considered, withCrowd, pct: null, label: null, unlockIn };
  const pct = Math.round((withCrowd / considered) * 100);
  return { considered, withCrowd, pct, label: takeLabel(pct), unlockIn: 0 };
}
