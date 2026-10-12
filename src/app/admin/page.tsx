import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, isAdminCookie } from '@/lib/auth';
import { isClosed } from '@/lib/results';
import { getStore, storeKind } from '@/lib/store';
import type { Dilemma } from '@/lib/types';

export const dynamic = 'force-dynamic';

const METRICS: [string, string][] = [
  ['page_view', 'Page views'],
  ['dilemma_view', 'Dilemma views'],
  ['vote_started', 'Votes started'],
  ['vote_completed', 'Votes completed'],
  ['second_dilemma_vote', 'Returned for a second dilemma'],
  ['share_clicked', 'Share clicks'],
  ['share_completed', 'Shares completed'],
  ['submission_started', 'Submissions started'],
  ['submission_completed', 'Submissions sent'],
  ['report_submitted', 'Reports sent'],
  ['discussion_loaded', 'Discussion loads'],
];

const SHARE_COPY_VARIANTS: [string, string][] = [
  ['a', '“Only X% agree with me. Prove me wrong.”'],
  ['b', '“X% picked the other side. Is the crowd right?”'],
  ['c', '“The vote is X%–Y%. What would you choose?”'],
];

const toLocalInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');
const inp = 'mt-1 w-full border-2 border-ink bg-white p-2';

function Hidden({ action, id }: { action: string; id?: string }) {
  return (
    <>
      <input type="hidden" name="action" value={action} />
      {id && <input type="hidden" name="id" value={id} />}
    </>
  );
}

function ActionButton({ action, id, label, danger }: { action: string; id: string; label: string; danger?: boolean }) {
  return (
    <form method="post" action="/api/admin/action" className="inline">
      <Hidden action={action} id={id} />
      <button type="submit" className={`px-3 py-1 text-sm font-bold ${danger ? 'border-2 border-sideb text-sideb hover:bg-white' : 'bg-ink text-white hover:bg-sidea'}`}>
        {label}
      </button>
    </form>
  );
}

function EditForm({ d }: { d: Dilemma }) {
  return (
    <form method="post" action="/api/admin/action" className="mt-3 grid gap-3 sm:grid-cols-2">
      <Hidden action="update" id={d.id} />
      <label className="sm:col-span-2 text-sm font-bold">Question<input name="question" defaultValue={d.question} required maxLength={140} className={inp} /></label>
      <label className="sm:col-span-2 text-sm font-bold">Context<input name="context" defaultValue={d.context} maxLength={280} className={inp} /></label>
      <label className="text-sm font-bold">Side A label<input name="sideALabel" defaultValue={d.sideALabel} required maxLength={24} className={inp} /></label>
      <label className="text-sm font-bold">Side B label<input name="sideBLabel" defaultValue={d.sideBLabel} required maxLength={24} className={inp} /></label>
      <label className="text-sm font-bold">Side A description<input name="sideADescription" defaultValue={d.sideADescription} maxLength={160} className={inp} /></label>
      <label className="text-sm font-bold">Side B description<input name="sideBDescription" defaultValue={d.sideBDescription} maxLength={160} className={inp} /></label>
      <label className="text-sm font-bold">Closes (UTC, leave empty for never)<input type="datetime-local" name="closesAt" defaultValue={toLocalInput(d.closesAt)} className={inp} /></label>
      <div className="flex items-end"><button type="submit" className="bg-ink px-4 py-2 font-bold text-white hover:bg-sidea">Save changes</button></div>
    </form>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: { msg?: string } }) {
  if (!isAdminCookie(cookies().get(ADMIN_COOKIE)?.value)) redirect('/admin/login');

  const store = getStore();
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const [dilemmas, submissions, reports, events] = await Promise.all([
    store.listDilemmas(),
    store.listSubmissions('pending'),
    store.listReports('open'),
    store.countEvents(since),
  ]);
  const counts = await store.getCounts(dilemmas.map((d) => d.id));
  const totalVotes = dilemmas.reduce((n, d) => n + (counts[d.id]?.a ?? 0) + (counts[d.id]?.b ?? 0), 0);
  const msg = searchParams.msg?.slice(0, 200);

  return (
    <main className="mx-auto max-w-5xl px-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-4xl font-extrabold tracking-tight">Editor desk</h1><Link href="/admin/matchups" className="mt-2 inline-flex min-h-10 items-center rounded-lg bg-sidea px-4 py-2 font-bold text-white hover:brightness-95">Manage matchups →</Link></div>
        <form method="post" action="/api/admin/logout"><button className="border-2 border-ink px-4 py-2 font-bold hover:bg-white" type="submit">Sign out</button></form>
      </div>
      <p className="mt-1 text-mute">Storage: {storeKind() === 'supabase' ? 'Supabase' : 'local JSON file (development only)'}</p>
      {msg && <p role="status" className="mt-4 border-l-4 border-ink bg-white px-3 py-2 font-semibold">{msg}</p>}

      <section className="mt-8" aria-labelledby="m">
        <h2 id="m" className="text-2xl font-extrabold">Last 7 days</h2>
        <dl className="mt-3 grid grid-cols-2 gap-px bg-rule sm:grid-cols-5">
          <div className="bg-white p-3"><dt className="text-sm text-mute">Total votes (all time)</dt><dd className="text-3xl font-extrabold">{totalVotes}</dd></div>
          {METRICS.map(([k, label]) => (
            <div key={k} className="bg-white p-3"><dt className="text-sm text-mute">{label}</dt><dd className="text-3xl font-extrabold">{events[k] ?? 0}</dd></div>
          ))}
        </dl>
      </section>

      <section className="mt-8" aria-labelledby="share-copy-results">
        <h2 id="share-copy-results" className="text-2xl font-extrabold">Share message test · last 7 days</h2>
        <p className="mt-1 text-sm text-mute">Visitors are randomly assigned one version, then kept in that version on this browser. Compare completed shares to find the strongest message.</p>
        <div className="mt-3 overflow-x-auto bg-white">
          <table className="w-full min-w-[36rem] text-left">
            <thead>
              <tr className="border-b-2 border-ink">
                <th scope="col" className="p-3">Message</th>
                <th scope="col" className="p-3">Started</th>
                <th scope="col" className="p-3">Completed</th>
                <th scope="col" className="p-3">Completion rate</th>
              </tr>
            </thead>
            <tbody>
              {SHARE_COPY_VARIANTS.map(([variant, copy]) => {
                const started = events[`share_copy_${variant}_started`] ?? 0;
                const completed = events[`share_copy_${variant}_completed`] ?? 0;
                const rate = started ? `${Math.round((completed / started) * 100)}%` : '—';
                return (
                  <tr key={variant} className="border-b border-rule">
                    <th scope="row" className="p-3 font-semibold">{copy}</th>
                    <td className="p-3">{started}</td>
                    <td className="p-3">{completed}</td>
                    <td className="p-3">{rate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="s">
        <h2 id="s" className="text-2xl font-extrabold">Submissions waiting ({submissions.length})</h2>
        {submissions.length === 0 && <p className="mt-2 text-mute">Nothing to review.</p>}
        <ul className="mt-3 space-y-4">
          {submissions.map((s) => (
            <li key={s.id} className="bg-white p-4">
              <p className="text-lg font-bold">{s.question}</p>
              <p className="mt-1"><span className="font-bold text-sidea">A:</span> {s.sideA}</p>
              <p><span className="font-bold text-sideb">B:</span> {s.sideB}</p>
              {s.context && <p className="text-mute">Context: {s.context}</p>}
              <p className="text-sm text-mute">From {s.submitterName || 'anonymous'} on {s.createdAt.slice(0, 10)}</p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <form method="post" action="/api/admin/action" className="flex flex-wrap items-end gap-3">
                  <Hidden action="approve_submission" id={s.id} />
                  <label className="text-sm font-bold">Short label A<input name="labelA" defaultValue="Yes" maxLength={24} className="mt-1 block w-32 border-2 border-ink p-2" /></label>
                  <label className="text-sm font-bold">Short label B<input name="labelB" defaultValue="No" maxLength={24} className="mt-1 block w-32 border-2 border-ink p-2" /></label>
                  <button type="submit" className="bg-ink px-4 py-2 font-bold text-white hover:bg-sidea">Approve</button>
                </form>
                <ActionButton action="reject_submission" id={s.id} label="Reject" danger />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="r">
        <h2 id="r" className="text-2xl font-extrabold">Open reports ({reports.length})</h2>
        {reports.length === 0 && <p className="mt-2 text-mute">No open reports.</p>}
        <ul className="mt-3 space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 bg-white p-4">
              <div>
                <p className="font-bold">{r.targetType === 'dilemma' ? 'Dilemma' : 'Discussion comment'}: <Link href={`/d/${r.targetId}`} className="underline">/d/{r.targetId}</Link></p>
                <p>{r.reason}</p>
                <p className="text-sm text-mute">{r.createdAt.slice(0, 16).replace('T', ' ')} UTC</p>
              </div>
              <ActionButton action="resolve_report" id={r.id} label="Mark resolved" />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="d">
        <h2 id="d" className="text-2xl font-extrabold">Dilemmas ({dilemmas.length})</h2>
        <ul className="mt-3 space-y-4">
          {dilemmas.map((d) => {
            const c = counts[d.id] ?? { a: 0, b: 0 };
            return (
              <li key={d.id} className="bg-white p-4">
                <p className="text-lg font-bold">{d.question}</p>
                <p className="text-sm text-mute">
                  Status: <strong className="text-ink">{d.status}</strong>
                  {isClosed(d) ? ' (closed)' : ''} · {d.sideALabel} {c.a} / {d.sideBLabel} {c.b} · <Link href={`/d/${d.slug}`} className="underline">/d/{d.slug}</Link>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {d.status !== 'published' && <ActionButton action="publish" id={d.id} label="Publish" />}
                  {d.status === 'published' && <ActionButton action="unpublish" id={d.id} label="Unpublish" />}
                  {d.status !== 'removed' && <ActionButton action="remove" id={d.id} label="Remove" danger />}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer font-bold underline underline-offset-4">Edit or set closing date</summary>
                  <EditForm d={d} />
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="c">
        <h2 id="c" className="text-2xl font-extrabold">Create a dilemma</h2>
        <form method="post" action="/api/admin/action" className="mt-3 grid gap-3 bg-white p-4 sm:grid-cols-2">
          <Hidden action="create" />
          <label className="sm:col-span-2 text-sm font-bold">Question<input name="question" required minLength={10} maxLength={140} className={inp} /></label>
          <label className="sm:col-span-2 text-sm font-bold">Context (optional)<input name="context" maxLength={280} className={inp} /></label>
          <label className="text-sm font-bold">Side A short label<input name="sideALabel" required maxLength={24} placeholder="Yes" className={inp} /></label>
          <label className="text-sm font-bold">Side B short label<input name="sideBLabel" required maxLength={24} placeholder="No" className={inp} /></label>
          <label className="text-sm font-bold">Side A case<input name="sideADescription" maxLength={160} className={inp} /></label>
          <label className="text-sm font-bold">Side B case<input name="sideBDescription" maxLength={160} className={inp} /></label>
          <label className="text-sm font-bold">Closes (UTC, optional)<input type="datetime-local" name="closesAt" className={inp} /></label>
          <label className="flex items-end gap-2 pb-2 font-bold"><input type="checkbox" name="publish" /> Publish immediately</label>
          <div className="sm:col-span-2"><button type="submit" className="bg-ink px-5 py-3 font-bold text-white hover:bg-sidea">Create dilemma</button></div>
        </form>
      </section>
    </main>
  );
}
