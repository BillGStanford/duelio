import { createClient } from '@supabase/supabase-js';
import { slugify } from './validate';

export type DuelSide = 'a' | 'b';
export interface Matchup {
  id: string;
  slug: string;
  canonicalKey: string;
  nameA: string;
  nameB: string;
  descriptionA: string;
  descriptionB: string;
  imageA: string;
  imageB: string;
  sourceUrlA: string;
  sourceUrlB: string;
  status: 'published' | 'removed';
  isFeatured: boolean;
  createdAt: string;
}
export interface DuelRound {
  id: string;
  matchupId: string;
  roundNumber: number;
  startsAt: string;
  closesAt: string;
  closedAt: string | null;
  status: 'active' | 'closed';
  winnerSide: DuelSide | 'tie' | null;
  votesA: number;
  votesB: number;
}
export interface EntityInfo {
  title: string;
  description: string;
  image: string;
  sourceUrl: string;
}

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Duelio Supabase is not configured.');
  return createClient(url, key, { auth: { persistSession: false } });
}
function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
const toMatchup = (r: any): Matchup => ({
  id: r.id, slug: r.slug, canonicalKey: r.canonical_key, nameA: r.name_a, nameB: r.name_b,
  descriptionA: r.description_a ?? '', descriptionB: r.description_b ?? '',
  imageA: r.image_a ?? '', imageB: r.image_b ?? '',
  sourceUrlA: r.source_url_a ?? '', sourceUrlB: r.source_url_b ?? '',
  status: r.status, isFeatured: r.is_featured === true, createdAt: r.created_at,
});
const toRound = (r: any): DuelRound => ({
  id: r.id, matchupId: r.matchup_id, roundNumber: r.round_number, startsAt: r.starts_at,
  closesAt: r.closes_at, closedAt: r.closed_at ?? null, status: r.status,
  winnerSide: r.winner_side ?? null, votesA: r.votes_a ?? 0, votesB: r.votes_b ?? 0,
});

export function normalizeEntityName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}
export function matchupIdentity(a: string, b: string) {
  const names = [normalizeEntityName(a), normalizeEntityName(b)].sort();
  const canonicalKey = names.join('::');
  const base = slugify(names.join('-vs-')).slice(0, 66).replace(/-+$/g, '') || 'matchup';
  let hash = 2166136261;
  for (const char of canonicalKey) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  const suffix = (hash >>> 0).toString(36).slice(0, 6);
  const slug = `${base}-${suffix}`;
  return { canonicalKey, slug };
}
export function fallbackEntity(name: string): EntityInfo {
  const clean = name.trim().slice(0, 100);
  return { title: clean, description: `${clean} is one side of this community-created Duelio matchup.`,
    image: `/api/entity-image?name=${encodeURIComponent(clean)}`, sourceUrl: '' };
}

export async function resolveEntity(name: string): Promise<EntityInfo> {
  const clean = name.trim().slice(0, 100);
  if (!clean) throw new Error('Enter both names.');
  try {
    const searchUrl = new URL('https://en.wikipedia.org/w/rest.php/v1/search/page');
    searchUrl.searchParams.set('q', clean);
    searchUrl.searchParams.set('limit', '1');
    const searchResponse = await fetch(searchUrl, { headers: { accept: 'application/json', 'user-agent': 'Duelio/1.0 (https://duelio.ink)' }, signal: AbortSignal.timeout(4500), next: { revalidate: 86400 } } as RequestInit & { next: { revalidate: number } });
    if (!searchResponse.ok) return fallbackEntity(clean);
    const search = await searchResponse.json() as { pages?: { title: string; description?: string; thumbnail?: { url?: string }; key?: string }[] };
    const page = search.pages?.[0];
    if (!page) return fallbackEntity(clean);
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;
    const summaryResponse = await fetch(summaryUrl, { headers: { accept: 'application/json', 'user-agent': 'Duelio/1.0 (https://duelio.ink)' }, signal: AbortSignal.timeout(4500), next: { revalidate: 86400 } } as RequestInit & { next: { revalidate: number } });
    if (!summaryResponse.ok) return {
      title: page.title, description: page.description || fallbackEntity(clean).description,
      image: page.thumbnail?.url || fallbackEntity(clean).image,
      sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    };
    const summary = await summaryResponse.json() as { title?: string; description?: string; extract?: string; thumbnail?: { source?: string }; content_urls?: { desktop?: { page?: string } } };
    return {
      title: summary.title || page.title,
      description: (summary.extract || page.description || fallbackEntity(clean).description).replace(/\s+/g, ' ').slice(0, 360),
      image: summary.thumbnail?.source || page.thumbnail?.url || fallbackEntity(clean).image,
      sourceUrl: summary.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    };
  } catch {
    return fallbackEntity(clean);
  }
}

export async function listMatchups(limit = 12, featuredFirst = false): Promise<Matchup[]> {
  try {
    const client = db();
    const pageSize = 500;
    const requested = Math.max(0, Math.min(limit, 10000));
    const all: any[] = [];
    // Explicitly paginate. A single Supabase select can be capped by project API
    // row limits, which otherwise silently truncates the matchup catalog.
    for (let offset = 0; offset < requested; offset += pageSize) {
      const take = Math.min(pageSize, requested - offset);
      const rows = check(await client.from('duel_matchups')
        .select('*')
        .eq('status', 'published')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + take - 1)) as any[];
      all.push(...rows);
      if (rows.length < take) break;
    }
    return all.map(toMatchup);
  } catch (error) {
    console.error('[Duelio] Failed to list published matchups:', error);
    return [];
  }
}
export async function getMatchup(slug: string): Promise<Matchup | null> {
  try {
    const row = check(await db().from('duel_matchups').select('*').eq('slug', slug).maybeSingle()) as any;
    return row ? toMatchup(row) : null;
  } catch { return null; }
}
export async function getRoundHistory(matchupId: string): Promise<DuelRound[]> {
  const rows = check(await db().from('duel_rounds').select('*').eq('matchup_id', matchupId).order('round_number', { ascending: false }).limit(50)) as any[];
  return rows.map(toRound);
}
export async function getActiveRound(matchupId: string): Promise<DuelRound> {
  const rows = check(await db().rpc('duel_ensure_active_round', { p_matchup_id: matchupId })) as any[];
  if (!rows?.[0]) throw new Error('No active round is available.');
  return toRound(rows[0]);
}
export async function getRoundCounts(roundId: string) {
  const client = db();
  const [a, b] = await Promise.all([
    client.from('duel_votes').select('id', { count: 'exact', head: true }).eq('round_id', roundId).eq('side', 'a'),
    client.from('duel_votes').select('id', { count: 'exact', head: true }).eq('round_id', roundId).eq('side', 'b'),
  ]);
  if (a.error) throw new Error(a.error.message);
  if (b.error) throw new Error(b.error.message);
  return { a: a.count ?? 0, b: b.count ?? 0 };
}
export async function createMatchup(a: string, b: string) {
  const cleanA = a.trim().replace(/\s+/g, ' ').slice(0, 100);
  const cleanB = b.trim().replace(/\s+/g, ' ').slice(0, 100);
  if (cleanA.length < 2 || cleanB.length < 2) throw new Error('Each side needs at least two characters.');
  if (normalizeEntityName(cleanA) === normalizeEntityName(cleanB)) throw new Error('Choose two different names.');
  const { canonicalKey, slug: baseSlug } = matchupIdentity(cleanA, cleanB);
  const client = db();
  const existing = check(await client.from('duel_matchups').select('*').eq('canonical_key', canonicalKey).maybeSingle()) as any;
  if (existing) {
    if (existing.status === 'removed') throw new Error('This matchup is currently unavailable.');
    await getActiveRound(existing.id);
    return toMatchup(existing);
  }
  const [entityA, entityB] = await Promise.all([resolveEntity(cleanA), resolveEntity(cleanB)]);
  const row = {
    slug: baseSlug, canonical_key: canonicalKey,
    name_a: cleanA, name_b: cleanB,
    description_a: entityA.description, description_b: entityB.description,
    image_a: entityA.image, image_b: entityB.image,
    source_url_a: entityA.sourceUrl, source_url_b: entityB.sourceUrl,
    status: 'published',
  };
  let inserted: any;
  const attempt = await client.from('duel_matchups').insert(row).select('*').maybeSingle();
  if (attempt.error) {
    // Concurrent creation of the same unordered pair: return the canonical existing page.
    const raced = check(await client.from('duel_matchups').select('*').eq('canonical_key', canonicalKey).maybeSingle()) as any;
    if (!raced) throw new Error('Could not create this matchup. Try again.');
    inserted = raced;
  } else inserted = attempt.data;
  if (!inserted) throw new Error('Could not create this matchup. Try again.');
  // The locked database RPC creates the first round if absent, avoiding a half-created matchup.
  await getActiveRound(inserted.id);
  return toMatchup(inserted);
}
export async function castMatchupVote(roundId: string, voterHash: string, side: DuelSide) {
  const rows = check(await db().rpc('duel_cast_vote', { p_round_id: roundId, p_voter_hash: voterHash, p_side: side })) as { closed: boolean; duplicate: boolean; side: DuelSide | null }[];
  const result = rows?.[0];
  if (!result) throw new Error('Vote response was empty.');
  return { closed: result.closed, duplicate: result.duplicate, side: result.side };
}
export async function getVoterSide(roundId: string, voterHash: string): Promise<DuelSide | null> {
  const row = check(await db().from('duel_votes').select('side').eq('round_id', roundId).eq('voter_hash', voterHash).maybeSingle()) as { side: DuelSide } | null;
  return row?.side ?? null;
}
export async function getClosedWinner(matchupId: string): Promise<{ roundNumber: number; winnerSide: DuelSide | 'tie'; votesA: number; votesB: number; closedAt: string } | null> {
  const rows = check(await db().from('duel_rounds').select('*').eq('matchup_id', matchupId).eq('status', 'closed').in('winner_side', ['a','b']).order('round_number', { ascending: false }).limit(1)) as any[];
  const r = rows[0];
  return r ? { roundNumber: r.round_number, winnerSide: r.winner_side, votesA: r.votes_a, votesB: r.votes_b, closedAt: r.closed_at } : null;
}
export async function adminListMatchups(): Promise<Matchup[]> {
  const client = db();
  const rows: any[] = [];
  const pageSize = 500;
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const page = check(await client.from('duel_matchups').select('*').order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)) as any[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows.map(toMatchup);
}
export async function adminUpdateMatchup(id: string, patch: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};
  for (const key of ['name_a','name_b','description_a','description_b','image_a','image_b','status','is_featured']) {
    if (key in patch) safe[key] = patch[key];
  }
  if ('name_a' in safe || 'name_b' in safe) {
    const current = check(await db().from('duel_matchups').select('name_a,name_b').eq('id', id).single()) as { name_a: string; name_b: string };
    const a = String(safe.name_a ?? current.name_a), b = String(safe.name_b ?? current.name_b);
    if (normalizeEntityName(a) === normalizeEntityName(b)) throw new Error('Competitor names must be different.');
    safe.canonical_key = [normalizeEntityName(a), normalizeEntityName(b)].sort().join('::');
  }
  for (const key of ['image_a','image_b']) {
    if (typeof safe[key] === 'string' && safe[key] && !/^https:\/\//i.test(safe[key] as string)) throw new Error('Images must use an HTTPS URL.');
  }
  safe.updated_at = new Date().toISOString();
  const row = check(await db().from('duel_matchups').update(safe).eq('id', id).select('*').single()) as any;
  return toMatchup(row);
}
/** Admin moderation: add synthetic counted votes or remove existing votes from the active round. */
export async function adminAdjustVotes(matchupId: string, side: DuelSide, delta: number) {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 500) throw new Error('Adjustment must be between -500 and 500 votes.');
  const client = db();
  const round = await getActiveRound(matchupId);
  if (round.status !== 'active') throw new Error('No active round to adjust.');
  if (delta > 0) {
    const rows = Array.from({ length: delta }, () => ({
      round_id: round.id,
      voter_hash: `admin-adjust:${globalThis.crypto.randomUUID()}`,
      side,
    }));
    const result = await client.from('duel_votes').insert(rows);
    if (result.error) throw new Error(result.error.message);
  } else {
    const count = Math.abs(delta);
    const rows = check(await client.from('duel_votes').select('id').eq('round_id', round.id).eq('side', side).order('created_at', { ascending: false }).limit(count)) as { id: string }[];
    if (!rows.length) throw new Error('There are no votes on that side to remove.');
    const result = await client.from('duel_votes').delete().in('id', rows.map(row => row.id));
    if (result.error) throw new Error(result.error.message);
  }
  const counts = await getRoundCounts(round.id);
  const update = await client.from('duel_rounds').update({ votes_a: counts.a, votes_b: counts.b }).eq('id', round.id);
  if (update.error) throw new Error(update.error.message);
  return counts;
}
export async function adminCloseRound(id: string) {
  const rows = check(await db().rpc('duel_admin_close_round', { p_matchup_id: id })) as any[];
  return rows?.[0] ? toRound(rows[0]) : null;
}

/** Return false when the migration has not been applied; lets production hide the new feature safely. */
export async function isMatchupSchemaReady(): Promise<boolean> {
  try {
    const result = await db().from('duel_matchups').select('id', { head: true, count: 'exact' });
    return !result.error;
  } catch { return false; }
}
