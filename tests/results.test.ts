import { describe, expect, it } from 'vitest';
import { computeResults, isClosed, isDeadHeat, isHot, verdictLine, winnerLabel } from '@/lib/results';

const labels = { sideALabel: 'Yes', sideBLabel: 'No' };

describe('results', () => {
  it('handles zero votes without dividing by zero', () => {
    expect(computeResults({ a: 0, b: 0 })).toEqual({ a: 0, b: 0, total: 0, pctA: 50, pctB: 50 });
  });
  it('always sums to 100', () => {
    for (const [a, b] of [[1, 2], [1, 6], [33, 67], [5, 5], [1, 0]]) {
      const r = computeResults({ a, b });
      expect(r.pctA + r.pctB).toBe(100);
    }
  });
  it('rounds the split', () => {
    const r = computeResults({ a: 61, b: 39 });
    expect([r.pctA, r.pctB, r.total]).toEqual([61, 39, 100]);
  });
  it('flags a dead heat only with a meaningful sample and a 45–55 split', () => {
    expect(isDeadHeat({ a: 4, b: 5 })).toBe(false);
    expect(isDeadHeat({ a: 45, b: 55 })).toBe(true);
    expect(isDeadHeat({ a: 44, b: 56 })).toBe(false);
  });
  it('pins hot dilemmas once they reach ten votes', () => {
    expect(isHot({ a: 4, b: 5 })).toBe(false);
    expect(isHot({ a: 5, b: 5 })).toBe(true);
  });
  it('never calls a side objectively correct', () => {
    expect(verdictLine(computeResults({ a: 3, b: 1 }), labels)).toBe('The crowd picked Yes.');
    expect(verdictLine(computeResults({ a: 1, b: 3 }), labels)).toBe('The crowd picked No.');
    expect(verdictLine(computeResults({ a: 2, b: 2 }), labels)).toMatch(/split/);
    expect(winnerLabel(computeResults({ a: 0, b: 0 }), labels)).toBeNull();
  });
  it('detects closed dilemmas', () => {
    const now = new Date('2026-01-10T00:00:00Z');
    expect(isClosed({ closesAt: null }, now)).toBe(false);
    expect(isClosed({ closesAt: '2026-01-11T00:00:00Z' }, now)).toBe(false);
    expect(isClosed({ closesAt: '2026-01-09T00:00:00Z' }, now)).toBe(true);
  });
});
