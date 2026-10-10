import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { LEGACY_SEED_COUNT, SEED_DILEMMAS } from '../seed';
import type {
  ContentStatus,
  Counts,
  DailyDilemma,
  Defense,
  Dilemma,
  DilemmaPatch,
  NewDilemma,
  Report,
  CrowdPrediction,
  Side,
  Submission,
} from '../types';
import type { Store } from './types';
import { dailyCloseAt, dailyIndex, previousUtcDate } from '../daily';

interface VoteRow {
  id: string;
  dilemmaId: string;
  side: Side;
  voter: string;
  room?: string | null;
  voterName?: string | null;
  guessedPctA?: number | null;
  createdAt: string;
}
interface DefenseRow {
  id: string;
  dilemmaId: string;
  voter: string;
  side: Side;
  body: string;
  createdAt: string;
}
interface DefenseEndorsementRow {
  defenseId: string;
  dilemmaId: string;
  voter: string;
}
interface DailyDilemmaRow {
  date: string;
  dilemmaId: string;
  closesAt: string;
}
interface EventRow {
  id: string;
  name: string;
  props: Record<string, string | number | boolean>;
  createdAt: string;
}
interface DB {
  dilemmas: Dilemma[];
  votes: VoteRow[];
  submissions: Submission[];
  reports: Report[];
  events: EventRow[];
  dailyDilemmas?: DailyDilemmaRow[];
  defenses?: DefenseRow[];
  defenseEndorsements?: DefenseEndorsementRow[];
}

const MAX_EVENTS = 20000;

export function seedDilemmas(now = new Date()): Dilemma[] {
  return SEED_DILEMMAS.map((s, i) => {
    const t = new Date(now.getTime() + i * 1000).toISOString();
    return {
      id: randomUUID(),
      ...s,
      status: 'published' as const,
      editorial: true,
      submittedBy: null,
      publishedAt: t,
      closesAt: null,
      createdAt: t,
      updatedAt: t,
    };
  });
}

/**
 * JSON-file store for local development and single-server hosting.
 * On serverless hosts (Vercel) the filesystem is ephemeral: use Supabase there.
 */
export class FileStore implements Store {
  private db: DB | null = null;
  private loading: Promise<DB> | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private file: string) {}

  private load(): Promise<DB> {
    if (this.db) return Promise.resolve(this.db);
    this.loading ??= (async () => {
      try {
        this.db = JSON.parse(await fs.readFile(this.file, 'utf8')) as DB;
      } catch {
        this.db = {
          dilemmas: seedDilemmas(),
          votes: [],
          submissions: [],
          reports: [],
          events: [],
          dailyDilemmas: [],
          defenses: [],
          defenseEndorsements: [],
        };
        await this.persist();
        return this.db;
      }
      this.db.dailyDilemmas ??= [];
      this.db.defenses ??= [];
      this.db.defenseEndorsements ??= [];
      const slugs = new Set(this.db.dilemmas.map((d) => d.slug));
      const hasLegacySeeds = SEED_DILEMMAS
        .slice(0, LEGACY_SEED_COUNT)
        .some((d) => slugs.has(d.slug));
      let addedSeed = false;
      if (hasLegacySeeds) {
        for (const seed of SEED_DILEMMAS.slice(LEGACY_SEED_COUNT)) {
          if (slugs.has(seed.slug)) continue;
          const now = new Date().toISOString();
          this.db.dilemmas.push({
            id: randomUUID(),
            ...seed,
            status: 'published',
            editorial: true,
            submittedBy: null,
            publishedAt: now,
            closesAt: null,
            createdAt: now,
            updatedAt: now,
          });
          slugs.add(seed.slug);
          addedSeed = true;
        }
      }
      if (addedSeed) await this.persist();
      return this.db;
    })();
    return this.loading;
  }

  private async persist() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(this.db));
    await fs.rename(tmp, this.file);
  }

  private mutate<T>(fn: (db: DB) => T): Promise<T> {
    const run = this.chain.then(async () => {
      const db = await this.load();
      const result = fn(db);
      await this.persist();
      return result;
    });
    this.chain = run.catch(() => undefined);
    return run;
  }

  async listDilemmas(opts?: { status?: ContentStatus }) {
    const db = await this.load();
    const rows = opts?.status ? db.dilemmas.filter((d) => d.status === opts.status) : [...db.dilemmas];
    return rows
      .sort((x, y) => (x.publishedAt ?? x.createdAt).localeCompare(y.publishedAt ?? y.createdAt))
      .map((d) => ({ ...d }));
  }

  async getDilemmaBySlug(slug: string) {
    const db = await this.load();
    const d = db.dilemmas.find((x) => x.slug === slug);
    return d ? { ...d } : null;
  }

  async getDilemmaById(id: string) {
    const db = await this.load();
    const d = db.dilemmas.find((x) => x.id === id);
    return d ? { ...d } : null;
  }

  async slugExists(slug: string) {
    const db = await this.load();
    return db.dilemmas.some((x) => x.slug === slug);
  }

  createDilemma(input: NewDilemma) {
    return this.mutate((db) => {
      if (db.dilemmas.some((d) => d.slug === input.slug)) throw new Error('slug taken');
      const now = new Date().toISOString();
      const d: Dilemma = {
        id: randomUUID(),
        ...input,
        publishedAt: input.status === 'published' ? now : null,
        createdAt: now,
        updatedAt: now,
      };
      db.dilemmas.push(d);
      return { ...d };
    });
  }

  updateDilemma(id: string, patch: DilemmaPatch) {
    return this.mutate((db) => {
      const d = db.dilemmas.find((x) => x.id === id);
      if (!d) return null;
      const now = new Date().toISOString();
      Object.assign(d, patch, { updatedAt: now });
      if (patch.status === 'published' && !d.publishedAt) d.publishedAt = now;
      return { ...d };
    });
  }

  getDailyDilemma(date: string): Promise<DailyDilemma | null> {
    return this.mutate((db) => {
      const assignments = db.dailyDilemmas ?? (db.dailyDilemmas = []);
      const existing = assignments.find((x) => x.date === date);
      if (existing) {
        const dilemma = db.dilemmas.find((x) => x.id === existing.dilemmaId && x.status === 'published');
        if (dilemma) return { dilemma: { ...dilemma }, closesAt: existing.closesAt };
        assignments.splice(assignments.indexOf(existing), 1);
      }

      const dayStart = Date.parse(`${date}T00:00:00.000Z`);
      const previous = assignments.find((x) => x.date === previousUtcDate(date));
      const candidates = db.dilemmas
        .filter((d) => d.status === 'published' && (!d.closesAt || Date.parse(d.closesAt) > dayStart))
        .sort((a, b) => (a.publishedAt ?? a.createdAt).localeCompare(b.publishedAt ?? b.createdAt))
        .filter((d) => d.id !== previous?.dilemmaId);
      const index = dailyIndex(date, candidates.length);
      const dilemma = index >= 0 ? candidates[index] : null;
      if (!dilemma) return null;

      const assignment = { date, dilemmaId: dilemma.id, closesAt: dailyCloseAt(date) };
      assignments.push(assignment);
      return { dilemma: { ...dilemma }, closesAt: assignment.closesAt };
    });
  }

  async getLatestDailyClose(dilemmaId: string) {
    const db = await this.load();
    const latest = (db.dailyDilemmas ?? [])
      .filter((x) => x.dilemmaId === dilemmaId)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return latest?.closesAt ?? null;
  }

  castVote(
    dilemmaId: string,
    side: Side,
    voter: string,
    room: string | null = null,
    voterName: string | null = null,
    guessedPctA: number | null = null,
  ) {
    return this.mutate((db) => {
      const existing = db.votes.find((v) => v.dilemmaId === dilemmaId && v.voter === voter);
      if (existing) return { duplicate: true, side: existing.side };
      db.votes.push({
        id: randomUUID(),
        dilemmaId,
        side,
        voter,
        room,
        voterName,
        guessedPctA,
        createdAt: new Date().toISOString(),
      });
      return { duplicate: false, side };
    });
  }

  async getVote(dilemmaId: string, voter: string) {
    const db = await this.load();
    return db.votes.find((v) => v.dilemmaId === dilemmaId && v.voter === voter)?.side ?? null;
  }

  async getVoteDetail(dilemmaId: string, voter: string) {
    const db = await this.load();
    const v = db.votes.find((x) => x.dilemmaId === dilemmaId && x.voter === voter);
    return v ? { side: v.side, room: v.room ?? null, guessedPctA: v.guessedPctA ?? null } : null;
  }

  async getNamedVotes(dilemmaId: string) {
    const db = await this.load();
    return db.votes
      .filter((v) => v.dilemmaId === dilemmaId && v.voterName)
      .slice(-12)
      .reverse()
      .map((v) => ({ name: v.voterName!, side: v.side }));
  }

  async getCrowdPrediction(dilemmaId: string): Promise<CrowdPrediction> {
    const db = await this.load();
    const guesses = db.votes
      .map((v) => v.dilemmaId === dilemmaId ? v.guessedPctA : null)
      .filter((guess): guess is number => typeof guess === 'number' && Number.isInteger(guess));
    return {
      count: guesses.length,
      averagePctA: guesses.length ? Math.round(guesses.reduce((sum, guess) => sum + guess, 0) / guesses.length) : 50,
    };
  }

  async getDefense(dilemmaId: string, voter: string): Promise<Defense | null> {
    const db = await this.load();
    const defense = (db.defenses ?? []).find((d) => d.dilemmaId === dilemmaId && d.voter === voter);
    if (!defense) return null;
    const endorsements = (db.defenseEndorsements ?? []).filter((e) => e.defenseId === defense.id);
    return {
      id: defense.id,
      side: defense.side,
      body: defense.body,
      endorsements: endorsements.length,
      endorsedByMe: endorsements.some((e) => e.voter === voter),
    };
  }

  async getFeaturedDefense(dilemmaId: string, voter: string | null = null): Promise<Defense | null> {
    const db = await this.load();
    const candidates = (db.defenses ?? []).filter((d) => d.dilemmaId === dilemmaId);
    if (!candidates.length) return null;
    const endorsements = (db.defenseEndorsements ?? []).filter((e) => e.dilemmaId === dilemmaId);
    const ranked = candidates
      .map((d) => {
        const votes = endorsements.filter((e) => e.defenseId === d.id);
        return {
          defense: d,
          endorsements: votes.length,
          endorsedByMe: !!voter && votes.some((e) => e.voter === voter),
        };
      })
      .sort((a, b) => b.endorsements - a.endorsements || a.defense.createdAt.localeCompare(b.defense.createdAt))[0];
    return {
      id: ranked.defense.id,
      side: ranked.defense.side,
      body: ranked.defense.body,
      endorsements: ranked.endorsements,
      endorsedByMe: ranked.endorsedByMe,
    };
  }

  createDefense(dilemmaId: string, voter: string, side: Side, body: string): Promise<Defense> {
    return this.mutate((db) => {
      const vote = db.votes.find((v) => v.dilemmaId === dilemmaId && v.voter === voter);
      if (!vote) throw new Error('Vote before submitting a defense.');
      if (vote.side === side) throw new Error('Defend the side you did not pick.');
      if ((db.defenses ?? []).some((d) => d.dilemmaId === dilemmaId && d.voter === voter))
        throw new Error('You already submitted a defense.');
      const defense: DefenseRow = {
        id: randomUUID(),
        dilemmaId,
        voter,
        side,
        body,
        createdAt: new Date().toISOString(),
      };
      (db.defenses ?? (db.defenses = [])).push(defense);
      return { id: defense.id, side, body, endorsements: 0, endorsedByMe: false };
    });
  }

  endorseDefense(dilemmaId: string, defenseId: string, voter: string) {
    return this.mutate((db) => {
      const defense = (db.defenses ?? []).find((d) => d.id === defenseId && d.dilemmaId === dilemmaId);
      if (!defense) throw new Error('Defense not found.');
      if (defense.voter === voter) throw new Error('You cannot endorse your own defense.');
      const endorsements = db.defenseEndorsements ?? (db.defenseEndorsements = []);
      const existing = endorsements.some((e) => e.defenseId === defenseId && e.voter === voter);
      if (!existing) endorsements.push({ defenseId, dilemmaId, voter });
      return {
        endorsements: endorsements.filter((e) => e.defenseId === defenseId).length,
        alreadyEndorsed: existing,
      };
    });
  }

  joinRoom(dilemmaId: string, voter: string, room: string) {
    return this.mutate((db) => {
      const v = db.votes.find((x) => x.dilemmaId === dilemmaId && x.voter === voter);
      if (!v || v.room) return false;
      v.room = room;
      return true;
    });
  }

  async getRoomCounts(dilemmaId: string, room: string) {
    const db = await this.load();
    const out: Counts = { a: 0, b: 0 };
    for (const v of db.votes) if (v.dilemmaId === dilemmaId && v.room === room) out[v.side] += 1;
    return out;
  }

  async getVoterHistory(voter: string) {
    const db = await this.load();
    return db.votes.filter((v) => v.voter === voter).map((v) => ({ dilemmaId: v.dilemmaId, side: v.side }));
  }

  async getCounts(ids: string[]) {
    const db = await this.load();
    const out: Record<string, Counts> = {};
    for (const id of ids) out[id] = { a: 0, b: 0 };
    for (const v of db.votes) if (out[v.dilemmaId]) out[v.dilemmaId][v.side] += 1;
    return out;
  }

  createSubmission(input: Parameters<Store['createSubmission']>[0]) {
    return this.mutate((db) => {
      const s: Submission = {
        id: randomUUID(),
        ...input,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      db.submissions.push(s);
      return { ...s };
    });
  }

  async getSubmission(id: string) {
    const db = await this.load();
    const s = db.submissions.find((x) => x.id === id);
    return s ? { ...s } : null;
  }

  async listSubmissions(status?: ContentStatus) {
    const db = await this.load();
    return db.submissions
      .filter((s) => !status || s.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((s) => ({ ...s }));
  }

  updateSubmissionStatus(id: string, status: ContentStatus) {
    return this.mutate((db) => {
      const s = db.submissions.find((x) => x.id === id);
      if (!s) return null;
      s.status = status;
      return { ...s };
    });
  }

  createReport(input: Parameters<Store['createReport']>[0]) {
    return this.mutate((db) => {
      const r: Report = { id: randomUUID(), ...input, status: 'open', createdAt: new Date().toISOString() };
      db.reports.push(r);
      return { ...r };
    });
  }

  async listReports(status?: 'open' | 'resolved') {
    const db = await this.load();
    return db.reports
      .filter((r) => !status || r.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => ({ ...r }));
  }

  async resolveReport(id: string) {
    await this.mutate((db) => {
      const r = db.reports.find((x) => x.id === id);
      if (r) r.status = 'resolved';
    });
  }

  async logEvent(name: string, props: Record<string, string | number | boolean>) {
    await this.mutate((db) => {
      db.events.push({ id: randomUUID(), name, props, createdAt: new Date().toISOString() });
      if (db.events.length > MAX_EVENTS) db.events.splice(0, db.events.length - MAX_EVENTS);
    });
  }

  async countEvents(sinceIso: string) {
    const db = await this.load();
    const out: Record<string, number> = {};
    for (const e of db.events) if (e.createdAt >= sinceIso) out[e.name] = (out[e.name] ?? 0) + 1;
    return out;
  }
}
