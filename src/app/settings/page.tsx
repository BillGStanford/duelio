'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import Shell from '@/components/game/Shell';
import { Avatar } from '@/components/game/Art';
import { AVATAR_COUNT, announcePoints, avatarSrc } from '@/lib/account';
import { getWikiClient } from '@/lib/wikirush-client';

export default function SettingsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(1);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const client = getWikiClient();
    if (!client) { setMessage('Accounts are not set up on this site yet.'); setLoading(false); return; }
    client.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      const user = data.session?.user;
      if (user) {
        const { data: p } = await client.from('wiki_profiles').select('display_name').eq('user_id', user.id).maybeSingle();
        setName(p?.display_name || String(user.user_metadata?.display_name || 'Explorer'));
        setAvatar(Number(user.user_metadata?.avatar) || 1);
      }
      setLoading(false);
    });
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault(); setMessage('');
    const client = getWikiClient();
    if (!client || !session?.user) return;
    const display_name = name.trim();
    if (display_name.length < 1 || display_name.length > 24) { setMessage('Your name must be 1 to 24 characters.'); return; }
    setSaving(true);
    const { error } = await client.from('wiki_profiles').update({ display_name }).eq('user_id', session.user.id);
    if (error) { setMessage('Could not save. Try again in a moment.'); setSaving(false); return; }
    await client.from('wiki_profiles').update({ avatar }).eq('user_id', session.user.id); // optional column; ignore failure
    const { error: metaErr } = await client.auth.updateUser({ data: { display_name, avatar } });
    setMessage(metaErr ? 'Saved, but your session did not refresh. Sign in again to see it everywhere.' : 'Saved!');
    announcePoints();
    setSaving(false);
  }
  async function signOut() { await getWikiClient()?.auth.signOut(); setSession(null); setMessage('Signed out.'); }

  return <Shell eyebrow="Account" title="Settings" sub="Choose how other players see you.">
    {loading ? <p className="text-white/70">Loading…</p>
      : !session ? <section className="gx-card p-6"><p>{message || 'Sign in to edit your player.'}</p><Link href="/login?next=/settings" className="gx-btn gx-btn-gold mt-4">Sign in</Link></section>
      : <>
        <form onSubmit={save} className="gx-card space-y-6 p-5 sm:p-7">
          <fieldset>
            <legend className="gx-label">Avatar</legend>
            <div className="flex items-center gap-4"><Avatar n={avatar} size={72} className="ring-4 ring-white/20" /><p className="text-sm text-white/65">Tap one to choose.</p></div>
            <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-12">
              {Array.from({ length: AVATAR_COUNT }, (_, i) => i + 1).map(n => <button key={n} type="button" onClick={() => setAvatar(n)} aria-label={`Avatar ${n}`} aria-pressed={avatar === n} className={`rounded-full p-0.5 transition ${avatar === n ? 'scale-110 bg-[#fbbf24]' : 'opacity-75 hover:opacity-100'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarSrc(n)} alt="" width={44} height={44} className="h-full w-full rounded-full" />
              </button>)}
            </div>
          </fieldset>
          <div><label htmlFor="s-name" className="gx-label">Player name</label><input id="s-name" value={name} onChange={e => setName(e.target.value)} maxLength={24} required className="gx-input" /><p className="mt-1 text-xs text-white/50">Shown on the leaderboard. 1 to 24 characters.</p></div>
          <div><label htmlFor="s-mail" className="gx-label">Email</label><input id="s-mail" readOnly value={session.user.email || ''} className="gx-input" /></div>
          <button disabled={saving} className="gx-btn gx-btn-gold">{saving ? 'Saving…' : 'Save changes'}</button>
        </form>
        <section className="gx-card mt-5 p-5 sm:p-7">
          <h2 className="text-lg font-bold">Session</h2>
          <p className="mt-1 text-sm text-white/70">Sign out of this device. Your points and level stay on your account.</p>
          <button onClick={signOut} className="gx-btn gx-btn-ghost mt-4">Sign out</button>
        </section>
      </>}
    {message && <p role="status" className="mt-4 break-words text-sm font-semibold text-white/80">{message}</p>}
  </Shell>;
}
