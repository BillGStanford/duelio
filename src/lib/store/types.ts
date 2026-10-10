import type {
  ContentStatus,
  Counts,
  Dilemma,
  DilemmaPatch,
  DailyDilemma,
  Defense,
  CrowdPrediction,
  NewDilemma,
  Report,
  ReportTarget,
  Side,
  Submission,
} from '../types';

export interface Store {
  listDilemmas(opts?: { status?: ContentStatus }): Promise<Dilemma[]>;
  getDilemmaBySlug(slug: string): Promise<Dilemma | null>;
  getDilemmaById(id: string): Promise<Dilemma | null>;
  slugExists(slug: string): Promise<boolean>;
  createDilemma(input: NewDilemma): Promise<Dilemma>;
  updateDilemma(id: string, patch: DilemmaPatch): Promise<Dilemma | null>;
  getDailyDilemma(date: string): Promise<DailyDilemma | null>;
  getLatestDailyClose(dilemmaId: string): Promise<string | null>;

  castVote(
    dilemmaId: string,
    side: Side,
    voterHash: string,
    room?: string | null,
    voterName?: string | null,
    guessedPctA?: number | null,
  ): Promise<{ duplicate: boolean; side: Side }>;
  getVote(dilemmaId: string, voterHash: string): Promise<Side | null>;
  getVoteDetail(dilemmaId: string, voterHash: string): Promise<{ side: Side; room: string | null; guessedPctA: number | null } | null>;
  getNamedVotes(dilemmaId: string): Promise<{ name: string; side: Side }[]>;
  getCrowdPrediction(dilemmaId: string): Promise<CrowdPrediction>;
  getDefense(dilemmaId: string, voterHash: string): Promise<Defense | null>;
  getFeaturedDefense(dilemmaId: string, voterHash?: string | null): Promise<Defense | null>;
  createDefense(dilemmaId: string, voterHash: string, side: Side, body: string): Promise<Defense>;
  endorseDefense(dilemmaId: string, defenseId: string, voterHash: string): Promise<{ endorsements: number; alreadyEndorsed: boolean }>;
  /** Attach an existing vote to a group chat room. Returns false if no vote, or it already has a room. */
  joinRoom(dilemmaId: string, voterHash: string, room: string): Promise<boolean>;
  getRoomCounts(dilemmaId: string, room: string): Promise<Counts>;
  getVoterHistory(voterHash: string): Promise<{ dilemmaId: string; side: Side }[]>;
  getCounts(dilemmaIds: string[]): Promise<Record<string, Counts>>;

  createSubmission(input: {
    question: string;
    sideA: string;
    sideB: string;
    context: string;
    submitterName: string;
  }): Promise<Submission>;
  getSubmission(id: string): Promise<Submission | null>;
  listSubmissions(status?: ContentStatus): Promise<Submission[]>;
  updateSubmissionStatus(id: string, status: ContentStatus): Promise<Submission | null>;

  createReport(input: { targetType: ReportTarget; targetId: string; reason: string }): Promise<Report>;
  listReports(status?: 'open' | 'resolved'): Promise<Report[]>;
  resolveReport(id: string): Promise<void>;

  logEvent(name: string, props: Record<string, string | number | boolean>): Promise<void>;
  countEvents(sinceIso: string): Promise<Record<string, number>>;
}
