'use client';

import Link from 'next/link';
import PointsCard from '@/components/PointsCard';
import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getWikiClient } from '@/lib/wikirush-client';

export default function SettingsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const client = getWikiClient();
    if (!client) { setMessage('Account service is not configured for this deployment yet.'); setLoading(false); return; }
    client.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      const user = data.session?.user;
      if (user) {
        const { data: p } = await client.from('wiki_profiles').select('display_name').eq('user_id', user.id).maybeSingle();
        setName(p?.display_name || String(user.user_metadata?.display_name || 'Trailblazer'));
      }
      setLoading(false);
    });
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault(); setMessage('');
    const client = getWikiClient();
    if (!client || !session?.user) return;
    const display_name = name.trim();
    if (display_name.length < 1 || display_name.length > 24) { setMessage('Display name must be between 1 and 24 characters.'); return; }
    setSaving(true);
    const { error } = await client.from('wiki_profiles').update({ display_name }).eq('user_id', session.user.id);
    if (!error) {
      const { error: metadataError } = await client.auth.updateUser({ data: { display_name } });
      setMessage(metadataError ? 'Profile saved. Your account metadata could not be refreshed.' : 'Profile saved.');
    } else setMessage('Could not save settings. Run the WikiRush database migration and try again.');
    setSaving(false);
  }
  async function signOut() { const client = getWikiClient(); await client?.auth.signOut(); setSession(null); setMessage('Signed out.'); }
  return <main className="mx-auto max-w-3xl px-5 py-12"><p className="text-xs font-black uppercase tracking-[.18em] text-[#6978f5]">Account controls</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">Settings.</h1><p className="mt-3 text-slate-600">Manage how other explorers see you and control your session.</p>{loading ? <p className="mt-8 text-slate-500">Loading settings…</p> : !session ? <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6"><p>{message || 'Sign in to manage your Duelio profile.'}</p><Link href="/wikirush" className="mt-4 inline-flex rounded-xl bg-[#6978f5] px-5 py-3 font-extrabold text-white">Go to sign in →</Link></section> : <><PointsCard /><form onSubmit={save} className="mt-8 space-y-5 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"><label className="block text-sm font-extrabold">Public display name<input value={name} onChange={e=>setName(e.target.value)} maxLength={24} minLength={1} required className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 text-base"/><span className="mt-1 block text-xs font-normal text-slate-500">Shown on your profile and the public leaderboard. 1–24 characters.</span></label><label className="block text-sm font-extrabold">Account email<input readOnly value={session.user.email || ''} className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base"/><span className="mt-1 block text-xs font-normal text-slate-500">Email changes are not available here.</span></label><button disabled={saving} className="rounded-xl bg-[#6978f5] px-5 py-3 font-extrabold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button></form><section className="mt-5 rounded-3xl border border-red-100 bg-white p-6"><h2 className="text-lg font-black">Session</h2><p className="mt-1 text-sm text-slate-600">Sign out of this device. Your saved points and streak remain on your account.</p><button onClick={signOut} className="mt-4 rounded-xl border border-red-200 px-4 py-3 font-bold text-red-700">Sign out</button></section></>}{message && <p role="status" className="mt-4 break-words text-sm text-slate-600">{message}</p>}</main>;
}
