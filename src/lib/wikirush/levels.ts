// Explorer levels: a visible ladder so points always mean something.
export type Level = { name: string; min: number; icon: string };

export const LEVELS: readonly Level[] = [
  { name: 'Rookie', min: 0, icon: '🥾' },
  { name: 'Explorer', min: 100, icon: '🧭' },
  { name: 'Navigator', min: 500, icon: '🗺️' },
  { name: 'Pathfinder', min: 1500, icon: '🔦' },
  { name: 'Cartographer', min: 4000, icon: '📜' },
  { name: 'Archivist', min: 10000, icon: '🏛️' },
  { name: 'Legend', min: 25000, icon: '👑' },
];

export type LevelInfo = { level: Level; next: Level | null; progress: number; toNext: number };

export function levelFor(points: number): LevelInfo {
  const p = Math.max(0, Math.floor(points));
  let idx = 0;
  LEVELS.forEach((l, i) => { if (p >= l.min) idx = i; });
  const level = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  if (!next) return { level, next, progress: 1, toNext: 0 };
  return { level, next, progress: (p - level.min) / (next.min - level.min), toNext: next.min - p };
}

/** Leaderboard points a finished game is worth. Mirrors submit_wikirush_game (total / 10, integer). */
export const pointsForGame = (total: number) => Math.floor(Math.max(0, total) / 10);
