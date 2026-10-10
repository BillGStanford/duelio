import { describe, expect, it } from 'vitest';
import { computeTake, takeLabel } from '@/lib/alignment';
import { newRoomCode, parseRoom } from '@/lib/room';

const hist = (sides: ('a' | 'b')[]) => sides.map((side, i) => ({ dilemmaId: `d${i}`, side }));
const counts = (cs: [number, number][]) => Object.fromEntries(cs.map(([a, b], i) => [`d${i}`, { a, b }]));

describe('crowd take', () => {
  it('stays locked until three debates have a clear crowd', () => {
    const t = computeTake(hist(['a', 'a']), counts([[5, 1], [4, 2]]));
    expect(t.pct).toBeNull();
    expect(t.unlockIn).toBe(1);
  });
  it('ignores debates with too few votes or a tie', () => {
    const t = computeTake(hist(['a', 'a', 'a', 'a']), counts([[1, 1], [2, 0], [5, 1], [3, 3]]));
    expect(t.considered).toBe(1);
  });
  it('computes how often you side with the majority', () => {
    const t = computeTake(hist(['a', 'b', 'a']), counts([[5, 1], [5, 1], [1, 5]]));
    expect(t).toMatchObject({ considered: 3, withCrowd: 1, pct: 33 });
    expect(t.label).toBe('Mostly against the crowd');
  });
  it('labels the range', () => {
    expect(takeLabel(100)).toMatch(/same person/);
    expect(takeLabel(0)).toMatch(/contrarian/);
  });
});

describe('rooms', () => {
  it('generates and validates codes', () => {
    // newRoomCode needs Web Crypto, present in Node 18+
    for (let i = 0; i < 20; i++) expect(parseRoom(newRoomCode())).not.toBeNull();
    expect(parseRoom('ABC123')).toBeNull();
    expect(parseRoom('abc12')).toBeNull();
    expect(parseRoom('../etc')).toBeNull();
    expect(parseRoom(undefined)).toBeNull();
  });
});
