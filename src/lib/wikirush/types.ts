export type WikiPage = {
  title: string;
  extract?: string;
  description?: string;
  thumbnail?: string;
  pageid?: number;
};

export type GameMode = 'daily' | 'classic' | 'wild' | 'challenge';

export type GameSettings = {
  mode: GameMode;
  /** Rounds per game: 1 (practice), 3 or 5. */
  rounds: number;
  /** Seconds per round. */
  seconds: number;
  /** Deterministic seed; absent for wild games. */
  seed?: string;
  /** Hand-built rounds from the admin desk ("detail challenges"). Overrides seed-based planning. */
  custom?: Array<{ start: string; target: string; blurb?: string }>;
  featuredId?: string;
  /** Release number of a featured challenge ("Day N Challenge"). */
  featuredDay?: number;
};

export type RoundResult = {
  start: string;
  target: string;
  won: boolean;
  /** How the round ended. */
  ending: 'arrived' | 'timeout' | 'gave-up';
  elapsedMs: number;
  limitMs: number;
  clicks: number;
  radar: boolean;
  /** Lost, but the final page linked straight to the target. */
  near: boolean;
  path: string[];
  score: number;
};

export type GameSummary = {
  settings: GameSettings;
  results: RoundResult[];
  total: number;
  max: number;
  finishedAt: string;
};

export type ChallengeParams = {
  seed: string;
  seconds: number;
  rounds: number;
  score?: number;
  name?: string;
};

export const ROUND_OPTIONS = [1, 3, 5] as const;
export const TIME_OPTIONS = [
  { seconds: 45, label: 'Blitz', hint: '45s' },
  { seconds: 90, label: 'Standard', hint: '90s' },
  { seconds: 180, label: 'Chill', hint: '3 min' },
] as const;

export const DAILY_SETTINGS = { rounds: 5, seconds: 90 } as const;
