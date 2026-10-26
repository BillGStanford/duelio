'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getWikiClient } from '@/lib/wikirush-client';

export const AVATAR_COUNT = 12;
export const POINTS_EVENT = 'duelio:points';

export type Account = {
  /** False until the first session check finishes, so the UI can avoid flashing the signed-out state. */
  ready: boolean;
  configured: boolean;
  signedIn: boolean;
  userId: string;
  email: string;
  name: string;
  avatar: number;
  points: number;
};

const EMPTY: Account = { ready: false, configured: false, signedIn: false, userId: '', email: '', name: '', avatar: 1, points: 0 };

export const avatarSrc = (n: number) => `/game/avatar-${String(Math.min(AVATAR_COUNT, Math.max(1, Math.round(n) || 1))).padStart(2, '0')}.png`;

/** Tell every mounted account hook that points changed (after a game is saved). */
export const announcePoints = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(POINTS_EVENT)); };

/** The signed-in player, their avatar, display name and live points. */
export function useAccount(): Account & { refresh(): void } {
  const [acct, setAcct] = useState<Account>(EMPTY);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    const client = getWikiClient();
    if (!client) { setAcct({ ...EMPTY, ready: true }); return; }
    let live = true;
    const load = async (session: Session | null) => {
      if (!session?.user) { if (live) setAcct({ ...EMPTY, ready: true, configured: true }); return; }
      const u = session.user;
      const meta = u.user_metadata || {};
      const base: Account = {
        ready: true, configured: true, signedIn: true, userId: u.id, email: u.email || '',
        name: String(meta.display_name || 'Explorer'), avatar: Number(meta.avatar) || 1, points: 0,
      };
      if (live) setAcct(prev => ({ ...base, points: prev.userId === u.id ? prev.points : 0 }));
      try {
        const { data: row } = await client.from('wiki_profiles').select('display_name, points').eq('user_id', u.id).maybeSingle();
        if (live && row) setAcct({ ...base, name: row.display_name || base.name, points: Number(row.points || 0) });
      } catch { /* keep the metadata view */ }
    };
    client.auth.getSession().then(({ data }) => load(data.session)).catch(() => live && setAcct({ ...EMPTY, ready: true, configured: true }));
    const { data: sub } = client.auth.onAuthStateChange((_e, s) => { void load(s); });
    const onPts = () => { void client.auth.getSession().then(({ data }) => load(data.session)); };
    window.addEventListener(POINTS_EVENT, onPts);
    return () => { live = false; sub.subscription.unsubscribe(); window.removeEventListener(POINTS_EVENT, onPts); };
  }, [tick]);

  return { ...acct, refresh };
}
