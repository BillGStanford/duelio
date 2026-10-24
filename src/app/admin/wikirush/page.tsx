import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import FeaturedForm from '@/components/FeaturedForm';
import { ADMIN_COOKIE, isAdminCookie } from '@/lib/auth';
import { listFeatured } from '@/lib/wikirush/featuredStore';
import type { Featured } from '@/lib/wikirush/featured';

export const dynamic = 'force-dynamic';

function Act({ action, id, label, danger }: { action: string; id: string; label: string; danger?: boolean }) {
  return <form method="post" action="/api/admin/wikirush" className="inline">
    <input type="hidden" name="action" value={action} /><input type="hidden" name="id" value={id} />
    <button type="submit" className={`px-3 py-1 text-sm font-bold ${danger ? 'border-2 border-sideb text-sideb hover:bg-white' : 'bg-ink text-white hover:bg-sidea'}`}>{label}</button>
  </form>;
}

export default async function AdminWikiRush({ searchParams }: { searchParams: { msg?: string } }) {
  if (!isAdminCookie(cookies().get(ADMIN_COOKIE)?.value)) redirect('/admin/login');
  let list: Featured[] = [];
  let loadError = '';
  try { list = await listFeatured(); } catch { loadError = 'Could not load challenges. Run the wikirush_featured block in supabase/wikirush-v2.sql.'; }
  const msg = searchParams.msg?.slice(0, 240);
  return <main className="mx-auto max-w-5xl px-5 pb-12">
    <Link href="/admin" className="text-sm font-bold underline">← Editor desk</Link>
    <h1 className="mt-2 text-4xl font-extrabold tracking-tight">WikiRush detail challenges</h1>
    <p className="mt-1 text-mute">Hand-pick exactly where a challenge starts and where it ends. Live ones appear as featured challenges in the WikiRush lobby and have their own share link.</p>
    {msg && <p role="status" className="mt-4 border-l-4 border-ink bg-white px-3 py-2 font-semibold">{msg}</p>}
    {loadError && <p role="alert" className="mt-4 border-l-4 border-sideb bg-white px-3 py-2 font-semibold">{loadError}</p>}

    <h2 className="mt-8 text-2xl font-extrabold">New challenge</h2>
    <FeaturedForm nextDay={list.reduce((m, f) => Math.max(m, f.day || 0), 0) + 1} />

    <h2 className="mt-10 text-2xl font-extrabold">All challenges ({list.length})</h2>
    <div className="mt-3 space-y-3">
      {list.length === 0 && <p className="bg-white p-4 text-mute">None yet.</p>}
      {list.map(f => <article key={f.id} className="bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold">{f.day ? `Day ${f.day} Challenge · ` : ''}{f.title} <span className={`ml-1 text-xs font-bold uppercase ${f.active ? 'text-green-700' : 'text-mute'}`}>{f.active ? 'live' : 'hidden'}</span></h3>
            {f.blurb && <p className="text-sm text-mute">{f.blurb}</p>}
            <ol className="mt-2 list-decimal pl-5 text-sm">{f.pairs.map((p, i) => <li key={i}>{p.start} → {p.target}{p.blurb ? <span className="text-mute"> · {p.blurb}</span> : null}</li>)}</ol>
            <p className="mt-1 text-xs text-mute">{f.seconds}s per round · link: /wikirush?f={f.id}</p>
          </div>
          <div className="flex gap-2">{f.active ? <Act action="hide" id={f.id} label="Hide" /> : <Act action="show" id={f.id} label="Show" />}<Act action="delete" id={f.id} label="Delete" danger /></div>
        </div>
      </article>)}
    </div>
  </main>;
}
