import type { SupabaseClient } from '@supabase/supabase-js';
import { AVATAR_COUNT } from '@/lib/account';

export type PlayerRow = { user_id: string; display_name: string; points: number; login_streak: number; best_streak: number; runs_played: number; avatar?: number | null };

/** Stable fallback avatar for players who never picked one. */
export function avatarFor(userId: string, picked?: number | null): number {
  if (picked && picked >= 1 && picked <= AVATAR_COUNT) return picked;
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return (h % AVATAR_COUNT) + 1;
}

/** Top players by points. Works before and after the optional `avatar` column exists. */
export async function loadTop(client: SupabaseClient, limit: number): Promise<{ rows: PlayerRow[]; error: boolean }> {
  const cols = 'user_id, display_name, points, login_streak, best_streak, runs_played';
  const run = (c: string) => client.from('wiki_profiles').select(c).order('points', { ascending: false }).order('runs_played', { ascending: true }).limit(limit);
  const first = await run(`${cols}, avatar`);
  if (!first.error) return { rows: (first.data || []) as unknown as PlayerRow[], error: false };
  const second = await run(cols);
  if (second.error) return { rows: [], error: true };
  return { rows: (second.data || []) as unknown as PlayerRow[], error: false };
}
