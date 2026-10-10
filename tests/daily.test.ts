import { describe, expect, it } from 'vitest';
import { dailyCloseAt, dailyIndex, effectiveCloseAt, previousUtcDate, utcDateKey } from '@/lib/daily';

describe('daily dilemma schedule helpers', () => {
  it('uses UTC dates consistently around midnight', () => {
    expect(utcDateKey(new Date('2026-10-10T00:15:00-07:00'))).toBe('2026-10-10');
    expect(previousUtcDate('2026-01-01')).toBe('2025-12-31');
    expect(dailyCloseAt('2026-10-09')).toBe('2026-10-10T00:00:00.000Z');
  });

  it('selects stable non-negative positions', () => {
    expect(dailyIndex('2026-10-09', 7)).toBe(1);
    expect(dailyIndex('2026-10-10', 7)).toBe(2);
    expect(dailyIndex('2026-10-09', 0)).toBe(-1);
    expect(dailyIndex('2026-10-09', 7)).toBeGreaterThanOrEqual(0);
  });

  it('uses the earlier editor or daily close time', () => {
    expect(effectiveCloseAt(null, '2026-10-10T00:00:00.000Z')).toBe('2026-10-10T00:00:00.000Z');
    expect(effectiveCloseAt('2026-10-09T20:00:00.000Z', '2026-10-10T00:00:00.000Z'))
      .toBe('2026-10-09T20:00:00.000Z');
    expect(effectiveCloseAt('2026-10-11T00:00:00.000Z', '2026-10-10T00:00:00.000Z'))
      .toBe('2026-10-10T00:00:00.000Z');
  });
});
