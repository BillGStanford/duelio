import type { SupabaseClient } from '@supabase/supabase-js';
import { FASTEST_MIN_CLICKS, type RecordRow } from '@/lib/wikirush/records';

type R = Promise<{ rows: RecordRow[]; error: boolean }>;
const T = 'wikirush_records';
const done = (res: { data: unknown; error: unknown }) => ({ rows: ((res.data as RecordRow[] | null) || []), error: !!res.error });

/** Fastest single finds on any page pair (3+ clicks, so one-click gimmes do not count). */
export async function topFinds(c: SupabaseClient, limit = 25): R {
  return done(await c.from(T).select('*').eq('kind', 'round').gte('clicks', FASTEST_MIN_CLICKS).order('elapsed_ms', { ascending: true }).limit(limit));
}

/** One record holder per page pair, fastest first. */
export async function pairRecords(c: SupabaseClient, limit = 40): R {
  const res = done(await c.from(T).select('*').eq('kind', 'round').order('elapsed_ms', { ascending: true }).limit(600));
  const seen = new Set<string>(); const rows: RecordRow[] = [];
  for (const r of res.rows) { if (!r.pair_key || seen.has(r.pair_key)) continue; seen.add(r.pair_key); rows.push(r); if (rows.length >= limit) break; }
  return { rows, error: res.error };
}

export async function bestGames(c: SupabaseClient, rounds: 3 | 5, limit = 25): R {
  return done(await c.from(T).select('*').eq('kind', 'game').eq('rounds', rounds).order('total', { ascending: false }).limit(limit));
}

/** Fastest clean sweep: every round won, lowest combined time. */
export async function sweeps(c: SupabaseClient, rounds: 3 | 5, limit = 25): R {
  return done(await c.from(T).select('*').eq('kind', 'game').eq('rounds', rounds).eq('all_won', true).not('elapsed_ms', 'is', null).order('elapsed_ms', { ascending: true }).limit(limit));
}

/** Top scores on one admin challenge, one row per player. */
export async function challengeBoard(c: SupabaseClient, featuredId: string, limit = 10): R {
  const res = done(await c.from(T).select('*').eq('kind', 'game').eq('featured_id', featuredId).order('total', { ascending: false }).limit(60));
  const seen = new Set<string>(); const rows: RecordRow[] = [];
  for (const r of res.rows) { if (seen.has(r.user_id)) continue; seen.add(r.user_id); rows.push(r); if (rows.length >= limit) break; }
  return { rows, error: res.error };
}

export async function recordById(c: SupabaseClient, id: string): Promise<RecordRow | null> {
  const { data } = await c.from(T).select('*').eq('id', id).eq('kind', 'round').maybeSingle();
  return (data as RecordRow | null) ?? null;
}
