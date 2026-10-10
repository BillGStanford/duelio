import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileStore, seedDilemmas } from '@/lib/store/file';
import { dailyCloseAt } from '@/lib/daily';

let dir: string;
let store: FileStore;

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'duelio-test-'));
  store = new FileStore(path.join(dir, 'db.json'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('FileStore', () => {
  it('seeds seven published editorial dilemmas in order', async () => {
    const ds = await store.listDilemmas({ status: 'published' });
    expect(ds.map((d) => d.slug)).toEqual([
      'roommate-electricity',
      'next-episode',
      'album-vs-streaming',
      'group-chat-lurker',
      'restaurant-check',
      'shoes-at-the-door',
      'long-voice-note',
    ]);
    expect(ds.every((d) => d.editorial)).toBe(true);
  });

  it('adds the two new daily starters to an existing five-seed file store', async () => {
    const legacy = seedDilemmas().slice(0, 5);
    writeFileSync(
      path.join(dir, 'db.json'),
      JSON.stringify({ dilemmas: legacy, votes: [], submissions: [], reports: [], events: [] }),
    );
    const upgraded = new FileStore(path.join(dir, 'db.json'));
    const dilemmas = await upgraded.listDilemmas({ status: 'published' });
    expect(dilemmas).toHaveLength(7);
    expect(dilemmas.map((d) => d.slug)).toEqual(
      expect.arrayContaining(['shoes-at-the-door', 'long-voice-note']),
    );
  });

  it('keeps daily assignments stable and closes them after 24 hours', async () => {
    const first = await store.getDailyDilemma('2026-10-09');
    const repeated = await store.getDailyDilemma('2026-10-09');
    const nextDay = await store.getDailyDilemma('2026-10-10');
    expect(first?.dilemma.id).toBe(repeated?.dilemma.id);
    expect(first?.closesAt).toBe(dailyCloseAt('2026-10-09'));
    expect(nextDay?.dilemma.id).not.toBe(first?.dilemma.id);
    expect(await store.getLatestDailyClose(first!.dilemma.id)).toBe(first!.closesAt);
  });

  it('counts votes and rejects a repeat vote from the same voter', async () => {
    const [d] = await store.listDilemmas();
    expect(await store.castVote(d.id, 'a', 'voter1')).toEqual({ duplicate: false, side: 'a' });
    expect(await store.castVote(d.id, 'b', 'voter1')).toEqual({ duplicate: true, side: 'a' });
    await store.castVote(d.id, 'b', 'voter2');
    expect((await store.getCounts([d.id]))[d.id]).toEqual({ a: 1, b: 1 });
    expect(await store.getVote(d.id, 'voter1')).toBe('a');
    expect(await store.getVote(d.id, 'nobody')).toBeNull();
  });

  it('stores optional public voter names with their side', async () => {
    const [d] = await store.listDilemmas();
    await store.castVote(d.id, 'b', 'named-voter', null, 'Sam');
    await store.castVote(d.id, 'a', 'anonymous-voter');
    expect(await store.getNamedVotes(d.id)).toEqual([{ name: 'Sam', side: 'b' }]);
  });

  it('stores crowd guesses and one opposite-side defense per voter', async () => {
    const [d] = await store.listDilemmas();
    await store.castVote(d.id, 'a', 'defender', null, null, 70);
    await store.castVote(d.id, 'b', 'endorser', null, null, 40);
    await store.castVote(d.id, 'b', 'second-defender', null, null, 55);
    expect(await store.getVoteDetail(d.id, 'defender')).toMatchObject({ guessedPctA: 70 });
    expect(await store.getCrowdPrediction(d.id)).toEqual({ count: 3, averagePctA: 55 });

    const defense = await store.createDefense(d.id, 'defender', 'b', 'The other side has a fair point.');
    await expect(store.createDefense(d.id, 'defender', 'b', 'A second defense for the same dilemma.')).rejects.toThrow();
    await expect(store.createDefense(d.id, 'endorser', 'b', 'This repeats the side I picked.')).rejects.toThrow();
    await expect(store.endorseDefense(d.id, defense.id, 'defender')).rejects.toThrow();
    expect(await store.endorseDefense(d.id, defense.id, 'endorser')).toMatchObject({ endorsements: 1, alreadyEndorsed: false });
    expect(await store.endorseDefense(d.id, defense.id, 'endorser')).toMatchObject({ endorsements: 1, alreadyEndorsed: true });
    expect(await store.getFeaturedDefense(d.id)).toMatchObject({ id: defense.id, endorsements: 1 });
    expect(await store.getDefense(d.id, 'defender')).toMatchObject({ body: 'The other side has a fair point.', endorsements: 1 });
  });

  it('survives concurrent votes without losing any', async () => {
    const [d] = await store.listDilemmas();
    await Promise.all(Array.from({ length: 50 }, (_, i) => store.castVote(d.id, i % 2 ? 'a' : 'b', `v${i}`)));
    const c = (await store.getCounts([d.id]))[d.id];
    expect(c.a + c.b).toBe(50);
  });

  it('persists to disk', async () => {
    const [d] = await store.listDilemmas();
    await store.castVote(d.id, 'a', 'x');
    const again = new FileStore(path.join(dir, 'db.json'));
    expect((await again.getCounts([d.id]))[d.id].a).toBe(1);
  });

  it('moves submissions through review and creates unpublished dilemmas', async () => {
    const s = await store.createSubmission({ question: 'Q?', sideA: 'A', sideB: 'B', context: '', submitterName: '' });
    expect(s.status).toBe('pending');
    expect((await store.listSubmissions('pending')).length).toBe(1);
    await store.updateSubmissionStatus(s.id, 'rejected');
    expect((await store.listSubmissions('pending')).length).toBe(0);

    const d = await store.createDilemma({
      slug: 'new-one', question: 'Is this new?', context: '', sideALabel: 'Yes', sideADescription: 'y',
      sideBLabel: 'No', sideBDescription: 'n', status: 'pending', editorial: false, submittedBy: null, closesAt: null,
    });
    expect(d.publishedAt).toBeNull();
    expect((await store.listDilemmas({ status: 'published' })).some((x) => x.slug === 'new-one')).toBe(false);
    const p = await store.updateDilemma(d.id, { status: 'published' });
    expect(p?.publishedAt).not.toBeNull();
    await expect(store.createDilemma({ ...d, status: 'pending', editorial: false, submittedBy: null })).rejects.toThrow();
  });

  it('stores reports and resolves them', async () => {
    const r = await store.createReport({ targetType: 'discussion', targetId: 'next-episode', reason: 'rude comment' });
    expect((await store.listReports('open')).length).toBe(1);
    await store.resolveReport(r.id);
    expect((await store.listReports('open')).length).toBe(0);
  });

  it('counts events in a window', async () => {
    await store.logEvent('page_view', { path: '/' });
    await store.logEvent('page_view', { path: '/' });
    await store.logEvent('vote_completed', {});
    const c = await store.countEvents(new Date(Date.now() - 60_000).toISOString());
    expect(c).toEqual({ page_view: 2, vote_completed: 1 });
    expect(await store.countEvents(new Date(Date.now() + 60_000).toISOString())).toEqual({});
  });
});

describe('rooms', () => {
  it('tallies votes per room and keeps them separate from the global count', async () => {
    const [d] = await store.listDilemmas();
    await store.castVote(d.id, 'a', 'v1', 'roomaa');
    await store.castVote(d.id, 'b', 'v2', 'roomaa');
    await store.castVote(d.id, 'a', 'v3', 'roombb');
    await store.castVote(d.id, 'b', 'v4');
    expect(await store.getRoomCounts(d.id, 'roomaa')).toEqual({ a: 1, b: 1 });
    expect(await store.getRoomCounts(d.id, 'roombb')).toEqual({ a: 1, b: 0 });
    expect((await store.getCounts([d.id]))[d.id]).toEqual({ a: 2, b: 2 });
    expect(await store.getVoteDetail(d.id, 'v1')).toEqual({ side: 'a', room: 'roomaa', guessedPctA: null });
  });

  it('lets an earlier vote join one room, once', async () => {
    const [d] = await store.listDilemmas();
    await store.castVote(d.id, 'a', 'v1');
    expect(await store.joinRoom(d.id, 'v1', 'roomaa')).toBe(true);
    expect(await store.joinRoom(d.id, 'v1', 'roombb')).toBe(false);
    expect(await store.joinRoom(d.id, 'nobody', 'roomaa')).toBe(false);
    expect(await store.getRoomCounts(d.id, 'roomaa')).toEqual({ a: 1, b: 0 });
  });

  it('returns a voter history', async () => {
    const ds = await store.listDilemmas();
    await store.castVote(ds[0].id, 'a', 'me');
    await store.castVote(ds[1].id, 'b', 'me');
    await store.castVote(ds[1].id, 'a', 'other');
    const h = await store.getVoterHistory('me');
    expect(h).toHaveLength(2);
    expect(h.find((x) => x.dilemmaId === ds[1].id)?.side).toBe('b');
  });
});
