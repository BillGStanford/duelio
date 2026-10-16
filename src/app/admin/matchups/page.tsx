import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, isAdminCookie } from '@/lib/auth';
import { adminListMatchups, getActiveRound, getRoundCounts, getRoundHistory } from '@/lib/matchups';
import EntityImage from '@/components/EntityImage';

export const dynamic = 'force-dynamic';
const field = 'mt-1 block min-h-10 w-full rounded-lg border border-rule bg-white px-3 py-2 text-sm font-normal';
function Hidden({ action, id }: { action: string; id?: string }) {
  return <><input type="hidden" name="action" value={action} />{id && <input type="hidden" name="id" value={id} />}</>;
}
export default async function MatchupAdmin({ searchParams }: { searchParams: { msg?: string } }) {
  if (!isAdminCookie(cookies().get(ADMIN_COOKIE)?.value)) redirect('/admin/login');
  const matchups = await adminListMatchups().catch(() => []);
  const stats = await Promise.all(matchups.map(async m => {
    try { const round = await getActiveRound(m.id); const counts = await getRoundCounts(round.id); const history = await getRoundHistory(m.id); return { round, counts, history }; }
    catch { return { round: null, counts: { a: 0, b: 0 }, history: [] }; }
  }));
  return (
    <main className="mx-auto max-w-5xl px-5 pb-12">
      <nav className="pt-3 text-sm"><Link href="/admin" className="font-bold underline underline-offset-4">← Back to editor desk</Link></nav>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-sidea">Administration</p><h1 className="mt-1 text-4xl font-black tracking-tight">Matchup management</h1><p className="mt-2 text-mute">Edit competitor details, hide or restore pages, and close a round when moderation requires it.</p></div><span className="rounded-full border border-rule bg-white px-3 py-2 text-sm font-bold">{matchups.length} matchups</span></div>
      {searchParams.msg && <p role="status" className="mt-4 rounded-xl border border-rule bg-white p-3 font-semibold">{searchParams.msg.slice(0,200)}</p>}
      <section className="mt-8 rounded-2xl border border-rule bg-white p-5 sm:p-7"><h2 className="text-2xl font-black">Create a matchup</h2><p className="mt-1 text-sm text-mute">Creates a public page and starts its first 14-day round. Existing pairs resolve to the canonical matchup.</p>
        <form method="post" action="/api/admin/matchups" className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end"><Hidden action="create"/><label className="text-sm font-bold">Competitor A<input className={field} name="nameA" required minLength={2} maxLength={100} placeholder="Alexander the Great"/></label><span className="pb-3 text-center font-black text-mute">VS</span><label className="text-sm font-bold">Competitor B<input className={field} name="nameB" required minLength={2} maxLength={100} placeholder="Napoleon"/></label><button className="min-h-11 rounded-lg bg-ink px-4 py-2 font-bold text-white hover:bg-sidea" type="submit">Create</button></form>
      </section>
      <section className="mt-8"><h2 className="text-2xl font-black">All matchups</h2>
        {matchups.length === 0 && <p className="mt-3 rounded-xl bg-white p-4 text-mute">No matchups yet, or the SQL migration has not been applied.</p>}
        <ul className="mt-4 space-y-5">{matchups.map((m,i) => {
          const {round,counts,history}=stats[i];
          return <li key={m.id} className="rounded-2xl border border-rule bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-sidea">{m.status} · {m.isFeatured ? 'HOMEPAGE HERO · ' : ''}{round ? `Round ${round.roundNumber}` : 'No active round'}</p><div className="mt-3 grid max-w-xl grid-cols-[72px_1fr_72px] items-center gap-3"><EntityImage src={m.imageA} name={m.nameA} className="h-20 w-[72px] rounded-lg border border-rule bg-paper p-1"/><h3 className="text-xl font-black">{m.nameA} <span className="text-sidea">vs.</span> {m.nameB}</h3><EntityImage src={m.imageB} name={m.nameB} className="h-20 w-[72px] rounded-lg border border-rule bg-paper p-1"/></div><p className="mt-1 text-sm text-mute">{counts.a + counts.b} votes this round · {history.filter(r=>r.status==='closed').length} completed rounds · <Link className="underline" href={`/matchup/${m.slug}`}>Open page ↗</Link></p></div><span className="rounded-full border border-rule px-3 py-1 text-xs font-bold">{round ? new Date(round.closesAt).toLocaleDateString() + ' close' : 'Round unavailable'}</span></div>
            <details className="mt-4"><summary className="cursor-pointer font-bold underline underline-offset-4">Edit names, descriptions and image URLs</summary>
              <form method="post" action="/api/admin/matchups" className="mt-4 grid gap-3 sm:grid-cols-2"><Hidden action="update" id={m.id}/>
                <label className="text-sm font-bold">Competitor A<input className={field} name="nameA" required maxLength={100} defaultValue={m.nameA}/></label>
                <label className="text-sm font-bold">Competitor B<input className={field} name="nameB" required maxLength={100} defaultValue={m.nameB}/></label>
                <label className="text-sm font-bold">A short info<textarea className={field} name="descriptionA" rows={3} maxLength={360} defaultValue={m.descriptionA}/></label>
                <label className="text-sm font-bold">B short info<textarea className={field} name="descriptionB" rows={3} maxLength={360} defaultValue={m.descriptionB}/></label>
                <label className="text-sm font-bold">A image URL<input className={field} name="imageA" type="url" maxLength={1000} defaultValue={m.imageA.startsWith('http')?m.imageA:''} placeholder="https://…"/></label>
                <label className="text-sm font-bold">B image URL<input className={field} name="imageB" type="url" maxLength={1000} defaultValue={m.imageB.startsWith('http')?m.imageB:''} placeholder="https://…"/></label>
                <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-rule bg-paper p-3 text-sm font-bold"><input type="checkbox" name="isFeatured" defaultChecked={m.isFeatured} className="mt-1 h-4 w-4 accent-[#6170f0]"/><span>Feature on homepage hero <span className="block mt-1 font-normal text-mute">Selected matchups rotate in the homepage hero. If none are selected, Duelio automatically features the top three by votes.</span></span></label><div className="sm:col-span-2"><button className="rounded-lg bg-ink px-4 py-2 font-bold text-white hover:bg-sidea" type="submit">Save details</button></div>
              </form>
            </details>
            <details className="mt-4 rounded-xl border border-rule bg-paper p-4">
              <summary className="cursor-pointer font-bold">Moderate votes for this round</summary>
              <p className="mt-2 text-sm text-mute">Add votes to correct an undercount, or remove recent votes from a side to reduce spam. Positive numbers add; negative numbers remove.</p>
              <form method="post" action="/api/admin/matchups" className="mt-3 flex flex-wrap items-end gap-3">
                <Hidden action="adjust_votes" id={m.id}/>
                <label className="text-sm font-bold">Side<select name="side" className={field}><option value="a">Blue · {m.nameA}</option><option value="b">Red · {m.nameB}</option></select></label>
                <label className="text-sm font-bold">Vote change<input className={field} type="number" name="delta" min="-500" max="500" step="1" required placeholder="e.g. -4 or 10"/></label>
                <button className="min-h-10 rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-sidea" type="submit">Apply adjustment</button>
              </form>
            </details>
            <div className="mt-4 flex flex-wrap gap-2">
              <form method="post" action="/api/admin/matchups"><Hidden action="status" id={m.id}/><input type="hidden" name="status" value={m.status==='published'?'removed':'published'}/><button className="rounded-lg border border-rule px-3 py-2 text-sm font-bold hover:bg-paper" type="submit">{m.status==='published'?'Remove from public view':'Restore public page'}</button></form>
              <form method="post" action="/api/admin/matchups"><Hidden action="close_round" id={m.id}/><button className="rounded-lg border border-rule px-3 py-2 text-sm font-bold hover:bg-paper" type="submit">Close round and start next</button></form>
            </div>
          </li>;
        })}</ul>
      </section>
    </main>
  );
}
