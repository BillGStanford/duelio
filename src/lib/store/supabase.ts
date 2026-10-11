import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
  Side,
  Submission,
  CrowdPrediction,
} from '../types';
import type { Store } from './types';
import { dailyCloseAt, dailyIndex, previousUtcDate } from '../daily';
import { aggregateVoteCounts } from '../results';

/* eslint-disable @typescript-eslint/no-explicit-any */
const toDilemma = (r: any): Dilemma => ({
  id: r.id,
  slug: r.slug,
  question: r.question,
  context: r.context ?? '',
  sideALabel: r.side_a_label,
  sideADescription: r.side_a_description ?? '',
  sideBLabel: r.side_b_label,
  sideBDescription: r.side_b_description ?? '',
  status: r.status,
  editorial: !!r.editorial,
  submittedBy: r.submitted_by ?? null,
  publishedAt: r.published_at ?? null,
  closesAt: r.closes_at ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const fromDilemma = (d: Partial<Dilemma>): Record<string, unknown> => {
  const map: Record<string, string> = {
    slug: 'slug',
    question: 'question',
    context: 'context',
    sideALabel: 'side_a_label',
    sideADescription: 'side_a_description',
    sideBLabel: 'side_b_label',
    sideBDescription: 'side_b_description',
    status: 'status',
    editorial: 'editorial',
    submittedBy: 'submitted_by',
    publishedAt: 'published_at',
    closesAt: 'closes_at',
  };
  const out: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(map)) if (k in d) out[col] = (d as any)[k];
  return out;
};

const toSubmission = (r: any): Submission => ({
  id: r.id,
  question: r.question,
  sideA: r.side_a,
  sideB: r.side_b,
  context: r.context ?? '',
  submitterName: r.submitter_name ?? '',
  status: r.status,
  createdAt: r.created_at,
});

const toReport = (r: any): Report => ({
  id: r.id,
  targetType: r.target_type,
  targetId: r.target_id,
  reason: r.reason,
  status: r.status,
  createdAt: r.created_at,
});

function check<T>(res: { data: T; error: any }): T {
  if (res.error) throw new Error(res.error.message || 'Supabase error');
  return res.data;
}

export class SupabaseStore implements Store {
  private sb: SupabaseClient;
  private seeded: Promise<void> | null = null;

  constructor(url: string, serviceKey: string) {
    this.sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  /** Seeds an empty table and adds only the new starter prompts to legacy installs. */
  private ensureSeed(): Promise<void> {
    this.seeded ??= (async () => {
      const { count, error } = await this.sb.from('dilemmas').select('id', { count: 'exact', head: true });
      if (error) throw new Error(error.message);
      let seeds = SEED_DILEMMAS;
      if (count && count > 0) {
        const legacySlugs = SEED_DILEMMAS.slice(0, LEGACY_SEED_COUNT).map((s) => s.slug);
        const legacyRows = check(await this.sb.from('dilemmas').select('slug').in('slug', legacySlugs)) as { slug: string }[];
        if (legacyRows.length === 0) return;
        const additions = SEED_DILEMMAS.slice(LEGACY_SEED_COUNT);
        const additionRows = check(
          await this.sb.from('dilemmas').select('slug').in('slug', additions.map((s) => s.slug)),
        ) as { slug: string }[];
        const existing = new Set(additionRows.map((r) => r.slug));
        seeds = additions.filter((s) => !existing.has(s.slug));
        if (seeds.length === 0) return;
      }
      const now = Date.now();
      const rows = seeds.map((s, i) => ({
        ...fromDilemma({
          ...s,
          status: 'published',
          editorial: true,
          submittedBy: null,
          closesAt: null,
        }),
        published_at: new Date(now + i * 1000).toISOString(),
      }));
      const ins = await this.sb.from('dilemmas').upsert(rows, { onConflict: 'slug', ignoreDuplicates: true });
      if (ins.error) throw new Error(ins.error.message);
    })().catch((e) => {
      this.seeded = null;
      throw e;
    });
    return this.seeded;
  }

  async listDilemmas(opts?: { status?: ContentStatus }) {
    await this.ensureSeed();
    const pageSize = 1000;
    const rows: any[] = [];
    for (let from = 0; ; from += pageSize) {
      let q = this.sb.from('dilemmas').select('*');
      if (opts?.status) q = q.eq('status', opts.status);
      const page = check(
        await q
          .order('published_at', { ascending: true, nullsFirst: false })
          .order('created_at')
          .order('id')
          .range(from, from + pageSize - 1),
      ) as any[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows.map(toDilemma);
  }

  async getDilemmaBySlug(slug: string) {
    await this.ensureSeed();
    const row = check(await this.sb.from('dilemmas').select('*').eq('slug', slug).maybeSingle());
    return row ? toDilemma(row) : null;
  }

  async getDilemmaById(id: string) {
    const row = check(await this.sb.from('dilemmas').select('*').eq('id', id).maybeSingle());
    return row ? toDilemma(row) : null;
  }

  async slugExists(slug: string) {
    const { count } = await this.sb.from('dilemmas').select('id', { count: 'exact', head: true }).eq('slug', slug);
    return (count ?? 0) > 0;
  }

  async createDilemma(input: NewDilemma) {
    const row: Record<string, unknown> = fromDilemma(input);
    if (input.status === 'published') row.published_at = new Date().toISOString();
    return toDilemma(check(await this.sb.from('dilemmas').insert(row).select('*').single()));
  }

  async updateDilemma(id: string, patch: DilemmaPatch) {
    const existing = await this.getDilemmaById(id);
    if (!existing) return null;
    const row: Record<string, unknown> = { ...fromDilemma(patch), updated_at: new Date().toISOString() };
    if (patch.status === 'published' && !existing.publishedAt) row.published_at = new Date().toISOString();
    return toDilemma(check(await this.sb.from('dilemmas').update(row).eq('id', id).select('*').single()));
  }

  async getDailyDilemma(date: string): Promise<DailyDilemma | null> {
    await this.ensureSeed();
    const readAssignment = async (dailyDate: string) =>
      check(await this.sb.from('daily_dilemmas').select('dilemma_id, closes_at').eq('daily_date', dailyDate).maybeSingle()) as
        | { dilemma_id: string; closes_at: string }
        | null;
    let assignment = await readAssignment(date);
    if (!assignment) {
      const [dilemmas, previous] = await Promise.all([
        this.listDilemmas({ status: 'published' }),
        readAssignment(previousUtcDate(date)),
      ]);
      const dayStart = Date.parse(`${date}T00:00:00.000Z`);
      const candidates = dilemmas
        .filter((d) => !d.closesAt || Date.parse(d.closesAt) > dayStart)
        .filter((d) => d.id !== previous?.dilemma_id);
      const index = dailyIndex(date, candidates.length);
      const selected = index >= 0 ? candidates[index] : null;
      if (!selected) return null;

      const inserted = await this.sb
        .from('daily_dilemmas')
        .upsert(
          { daily_date: date, dilemma_id: selected.id, closes_at: dailyCloseAt(date) },
          { onConflict: 'daily_date' },
        )
        .select('dilemma_id, closes_at')
        .maybeSingle();
      if (inserted.error) throw new Error(inserted.error.message);
      assignment = inserted.data as { dilemma_id: string; closes_at: string } | null;
      if (!assignment) assignment = await readAssignment(date);
    }
    if (!assignment) throw new Error(`Daily dilemma assignment for ${date} was not persisted or could not be read.`);
    const dilemma = await this.getDilemmaById(assignment.dilemma_id);
    return dilemma?.status === 'published' ? { dilemma, closesAt: assignment.closes_at } : null;
  }

  async getLatestDailyClose(dilemmaId: string) {
    const row = check(
      await this.sb
        .from('daily_dilemmas')
        .select('closes_at')
        .eq('dilemma_id', dilemmaId)
        .order('daily_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ) as { closes_at: string } | null;
    return row?.closes_at ?? null;
  }

  async castVote(
    dilemmaId: string,
    side: Side,
    voterHash: string,
    room: string | null = null,
    voterName: string | null = null,
    guessedPctA: number | null = null,
  ) {
    const ins = await this.sb
      .from('votes')
      .insert({
        dilemma_id: dilemmaId,
        side,
        anonymous_identifier: voterHash,
        room,
        voter_name: voterName,
        guessed_pct_a: guessedPctA,
      });
    if (!ins.error) return { duplicate: false, side };
    if ((ins.error as any).code === '23505') {
      const existing = await this.getVote(dilemmaId, voterHash);
      return { duplicate: true, side: existing ?? side };
    }
    throw new Error(ins.error.message);
  }

  async getVote(dilemmaId: string, voterHash: string) {
    const row = check(
      await this.sb
        .from('votes')
        .select('side')
        .eq('dilemma_id', dilemmaId)
        .eq('anonymous_identifier', voterHash)
        .maybeSingle(),
    ) as any;
    return row ? (row.side as Side) : null;
  }

  async getVoteDetail(dilemmaId: string, voterHash: string) {
    const row = check(
      await this.sb
        .from('votes')
        .select('side, room, guessed_pct_a')
        .eq('dilemma_id', dilemmaId)
        .eq('anonymous_identifier', voterHash)
        .maybeSingle(),
    ) as any;
    return row
      ? {
          side: row.side as Side,
          room: (row.room as string | null) ?? null,
          guessedPctA: (row.guessed_pct_a as number | null) ?? null,
        }
      : null;
  }

  async getNamedVotes(dilemmaId: string) {
    const rows = check(
      await this.sb
        .from('votes')
        .select('side, voter_name')
        .eq('dilemma_id', dilemmaId)
        .not('voter_name', 'is', null)
        .order('created_at', { ascending: false })
        .limit(12),
    ) as { side: Side; voter_name: string }[];
    return rows.map((r) => ({ name: r.voter_name, side: r.side }));
  }

  async getCrowdPrediction(dilemmaId: string): Promise<CrowdPrediction> {
    const rows = check(
      await this.sb
        .from('votes')
        .select('guessed_pct_a')
        .eq('dilemma_id', dilemmaId)
        .not('guessed_pct_a', 'is', null)
        .limit(50000),
    ) as { guessed_pct_a: number }[];
    const guesses = rows.map((r) => r.guessed_pct_a);
    return {
      count: guesses.length,
      averagePctA: guesses.length ? Math.round(guesses.reduce((sum, guess) => sum + guess, 0) / guesses.length) : 50,
    };
  }

  async getDefense(dilemmaId: string, voterHash: string): Promise<Defense | null> {
    const row = check(
      await this.sb
        .from('defenses')
        .select('id, side, body, defense_endorsements(anonymous_identifier)')
        .eq('dilemma_id', dilemmaId)
        .eq('anonymous_identifier', voterHash)
        .maybeSingle(),
    ) as {
      id: string;
      side: Side;
      body: string;
      defense_endorsements: { anonymous_identifier: string }[];
    } | null;
    return row
      ? {
          id: row.id,
          side: row.side,
          body: row.body,
          endorsements: row.defense_endorsements.length,
          endorsedByMe: row.defense_endorsements.some((e) => e.anonymous_identifier === voterHash),
        }
      : null;
  }

  async getFeaturedDefense(dilemmaId: string, voterHash: string | null = null): Promise<Defense | null> {
    const rows = check(
      await this.sb
        .from('defenses')
        .select('id, side, body, created_at, defense_endorsements(anonymous_identifier)')
        .eq('dilemma_id', dilemmaId)
        .order('created_at', { ascending: true })
        .limit(500),
    ) as {
      id: string;
      side: Side;
      body: string;
      created_at: string;
      defense_endorsements: { anonymous_identifier: string }[];
    }[];
    const ranked = rows
      .map((row) => ({
        row,
        endorsements: row.defense_endorsements.length,
        endorsedByMe: !!voterHash && row.defense_endorsements.some((e) => e.anonymous_identifier === voterHash),
      }))
      .sort((a, b) => b.endorsements - a.endorsements || a.row.created_at.localeCompare(b.row.created_at))[0];
    return ranked
      ? {
          id: ranked.row.id,
          side: ranked.row.side,
          body: ranked.row.body,
          endorsements: ranked.endorsements,
          endorsedByMe: ranked.endorsedByMe,
        }
      : null;
  }

  async createDefense(dilemmaId: string, voterHash: string, side: Side, body: string): Promise<Defense> {
    const vote = await this.getVote(dilemmaId, voterHash);
    if (!vote) throw new Error('Vote before submitting a defense.');
    if (vote === side) throw new Error('Defend the side you did not pick.');
    const row = check(
      await this.sb
        .from('defenses')
        .insert({ dilemma_id: dilemmaId, anonymous_identifier: voterHash, side, body })
        .select('id, side, body')
        .single(),
    ) as { id: string; side: Side; body: string };
    return { id: row.id, side: row.side, body: row.body, endorsements: 0, endorsedByMe: false };
  }

  async endorseDefense(dilemmaId: string, defenseId: string, voterHash: string) {
    const defense = check(
      await this.sb
        .from('defenses')
        .select('id, anonymous_identifier')
        .eq('dilemma_id', dilemmaId)
        .eq('id', defenseId)
        .maybeSingle(),
    ) as { id: string; anonymous_identifier: string } | null;
    if (!defense) throw new Error('Defense not found.');
    if (defense.anonymous_identifier === voterHash) throw new Error('You cannot endorse your own defense.');

    const inserted = await this.sb
      .from('defense_endorsements')
      .insert({ dilemma_id: dilemmaId, defense_id: defenseId, anonymous_identifier: voterHash });
    const alreadyEndorsed = inserted.error?.code === '23505';
    if (inserted.error && !alreadyEndorsed) throw new Error(inserted.error.message);
    const { count, error } = await this.sb
      .from('defense_endorsements')
      .select('id', { count: 'exact', head: true })
      .eq('defense_id', defenseId);
    if (error) throw new Error(error.message);
    return { endorsements: count ?? 0, alreadyEndorsed };
  }

  async joinRoom(dilemmaId: string, voterHash: string, room: string) {
    const rows = check(
      await this.sb
        .from('votes')
        .update({ room })
        .eq('dilemma_id', dilemmaId)
        .eq('anonymous_identifier', voterHash)
        .is('room', null)
        .select('id'),
    ) as any[];
    return rows.length > 0;
  }

  async getRoomCounts(dilemmaId: string, room: string) {
    const count = async (side: Side) => {
      const { count: c, error } = await this.sb
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .eq('dilemma_id', dilemmaId)
        .eq('room', room)
        .eq('side', side);
      if (error) throw new Error(error.message);
      return c ?? 0;
    };
    const [a, b] = await Promise.all([count('a'), count('b')]);
    return { a, b };
  }

  async getVoterHistory(voterHash: string) {
    const rows = check(
      await this.sb.from('votes').select('dilemma_id, side').eq('anonymous_identifier', voterHash).limit(500),
    ) as any[];
    return rows.map((r) => ({ dilemmaId: r.dilemma_id as string, side: r.side as Side }));
  }

  async getCounts(ids: string[]) {
    if (ids.length === 0) return {};

    const pageSize = 1000;
    const fetchPage = (from: number) =>
      this.sb
        .from('votes')
        .select('dilemma_id, side', from === 0 ? { count: 'exact' } : undefined)
        .in('dilemma_id', ids)
        .order('id')
        .range(from, from + pageSize - 1);
    const firstPage = await fetchPage(0);
    const firstRows = check(firstPage) as { dilemma_id: string; side: Side }[];
    if (firstPage.count === null) throw new Error('Supabase did not return the exact vote count.');

    const rows = [...firstRows];
    const expectedRows = firstPage.count;
    while (rows.length < expectedRows) {
      const page = check(await fetchPage(rows.length)) as { dilemma_id: string; side: Side }[];
      if (page.length === 0) throw new Error('Supabase returned an incomplete vote-count page.');
      rows.push(...page);
    }

    return aggregateVoteCounts(ids, rows);
  }

  async createSubmission(input: Parameters<Store['createSubmission']>[0]) {
    const row = check(
      await this.sb
        .from('submissions')
        .insert({
          question: input.question,
          side_a: input.sideA,
          side_b: input.sideB,
          context: input.context,
          submitter_name: input.submitterName,
          status: 'pending',
        })
        .select('*')
        .single(),
    );
    return toSubmission(row);
  }

  async getSubmission(id: string) {
    const row = check(await this.sb.from('submissions').select('*').eq('id', id).maybeSingle());
    return row ? toSubmission(row) : null;
  }

  async listSubmissions(status?: ContentStatus) {
    let q = this.sb.from('submissions').select('*');
    if (status) q = q.eq('status', status);
    return (check(await q.order('created_at', { ascending: false })) as any[]).map(toSubmission);
  }

  async updateSubmissionStatus(id: string, status: ContentStatus) {
    const row = check(await this.sb.from('submissions').update({ status }).eq('id', id).select('*').maybeSingle());
    return row ? toSubmission(row) : null;
  }

  async createReport(input: Parameters<Store['createReport']>[0]) {
    const row = check(
      await this.sb
        .from('reports')
        .insert({ target_type: input.targetType, target_id: input.targetId, reason: input.reason, status: 'open' })
        .select('*')
        .single(),
    );
    return toReport(row);
  }

  async listReports(status?: 'open' | 'resolved') {
    let q = this.sb.from('reports').select('*');
    if (status) q = q.eq('status', status);
    return (check(await q.order('created_at', { ascending: false })) as any[]).map(toReport);
  }

  async resolveReport(id: string) {
    check(await this.sb.from('reports').update({ status: 'resolved' }).eq('id', id));
  }

  async logEvent(name: string, props: Record<string, string | number | boolean>) {
    const { error } = await this.sb.from('events').insert({ name, props });
    if (error) throw new Error(error.message);
  }

  async countEvents(sinceIso: string) {
    const rows = check(
      await this.sb.from('events').select('name').gte('created_at', sinceIso).limit(50000),
    ) as any[];
    const out: Record<string, number> = {};
    for (const r of rows) out[r.name] = (out[r.name] ?? 0) + 1;
    return out;
  }
}
