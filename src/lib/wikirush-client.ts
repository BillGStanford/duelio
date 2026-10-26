import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let shared: SupabaseClient | null = null;
/** One shared browser client, so the nav, pages and game all see the same session. */
export function getWikiClient(): SupabaseClient | null {
  if (!url || !key) return null;
  if (!shared) shared = createClient(url, key);
  return shared;
}

export function referralUrl(code: string) {
  if (typeof window === 'undefined') return '';
  const url = new URL('/wikirush', window.location.origin);
  url.searchParams.set('ref', code);
  return url.toString();
}

export async function ensureWikiProfile(client: SupabaseClient, user: { id: string; user_metadata?: Record<string, unknown> }) {
  const metadataName = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : '';
  const name = metadataName.trim().slice(0, 24) || 'Trailblazer';
  const { data: existing } = await client.from('wiki_profiles').select('user_id, last_login_date, login_streak, best_streak').eq('user_id', user.id).maybeSingle();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (!existing) {
    const { data: created } = await client.from('wiki_profiles').insert({ user_id: user.id, display_name: name, last_login_date: today, login_streak: 1, best_streak: 1 }).select('user_id').maybeSingle();
    return created;
  }
  if (existing.last_login_date !== today) {
    const streak = existing.last_login_date === yesterday ? (existing.login_streak || 0) + 1 : 1;
    await client.from('wiki_profiles').update({ last_login_date: today, login_streak: streak, best_streak: Math.max(streak, existing.best_streak || 0) }).eq('user_id', user.id);
  }
  return existing;
}
