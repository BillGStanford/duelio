export type Side = 'a' | 'b';
export type ContentStatus = 'pending' | 'published' | 'rejected' | 'removed';

export interface Dilemma {
  id: string;
  slug: string;
  question: string;
  context: string;
  sideALabel: string;
  sideADescription: string;
  sideBLabel: string;
  sideBDescription: string;
  status: ContentStatus;
  editorial: boolean;
  submittedBy: string | null;
  publishedAt: string | null;
  closesAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyDilemma {
  dilemma: Dilemma;
  closesAt: string;
}

export type NewDilemma = Pick<
  Dilemma,
  | 'slug'
  | 'question'
  | 'context'
  | 'sideALabel'
  | 'sideADescription'
  | 'sideBLabel'
  | 'sideBDescription'
  | 'status'
  | 'editorial'
  | 'submittedBy'
  | 'closesAt'
>;

export type DilemmaPatch = Partial<
  Pick<
    Dilemma,
    | 'question'
    | 'context'
    | 'sideALabel'
    | 'sideADescription'
    | 'sideBLabel'
    | 'sideBDescription'
    | 'status'
    | 'closesAt'
  >
>;

export interface Submission {
  id: string;
  question: string;
  sideA: string;
  sideB: string;
  context: string;
  submitterName: string;
  status: ContentStatus;
  createdAt: string;
}

export type ReportTarget = 'dilemma' | 'discussion';
export interface Report {
  id: string;
  targetType: ReportTarget;
  targetId: string; // dilemma slug
  reason: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface Counts {
  a: number;
  b: number;
}

export interface Results extends Counts {
  total: number;
  pctA: number;
  pctB: number;
}

export interface CrowdPrediction {
  count: number;
  averagePctA: number;
}

export interface Defense {
  id: string;
  side: Side;
  body: string;
  endorsements: number;
  endorsedByMe: boolean;
}
