'use client';

import { useEffect, useRef, useState } from 'react';

type Pair = { start: string; target: string; blurb: string };
const inp = 'mt-1 w-full border-2 border-ink bg-white p-2';

/** Title box with live Wikipedia suggestions, so admins pick real pages instead of guessing spelling. */
function PagePicker({ label, value, onChange, listId }: { label: string; value: string; onChange(v: string): void; listId: string }) {
  const [options, setOptions] = useState<string[]>([]);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (value.trim().length < 2) { setOptions([]); return; }
    const ctl = new AbortController();
    timer.current = window.setTimeout(() => {
      fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&format=json&origin=*&limit=8&namespace=0&search=${encodeURIComponent(value.trim())}`, { signal: ctl.signal })
        .then(r => r.json()).then((d: [string, string[]]) => setOptions(d[1] || [])).catch(() => {});
    }, 220);
    return () => { ctl.abort(); if (timer.current) window.clearTimeout(timer.current); };
  }, [value]);
  return <label className="block text-sm font-bold">{label}
    <input list={listId} value={value} onChange={e => onChange(e.target.value)} maxLength={180} placeholder="Start typing a Wikipedia page…" className={inp} autoComplete="off" />
    <datalist id={listId}>{options.map(o => <option key={o} value={o} />)}</datalist>
  </label>;
}

export default function FeaturedForm() {
  const [pairs, setPairs] = useState<Pair[]>([{ start: '', target: '', blurb: '' }]);
  const set = (i: number, patch: Partial<Pair>) => setPairs(p => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const filled = pairs.filter(p => p.start.trim() || p.target.trim()).length;
  const valid = [1, 3, 5].includes(filled);
  return <form method="post" action="/api/admin/wikirush" className="mt-4 grid gap-4 bg-white p-4 sm:grid-cols-2">
    <input type="hidden" name="action" value="create" />
    <input type="hidden" name="pairs" value={JSON.stringify(pairs)} />
    <label className="text-sm font-bold">Challenge name<input name="title" required minLength={3} maxLength={60} placeholder="Melania Trump to Mars" className={inp} /></label>
    <label className="text-sm font-bold">Time per round
      <select name="seconds" defaultValue="90" className={inp}><option value="45">45 seconds</option><option value="90">90 seconds</option><option value="180">3 minutes</option></select>
    </label>
    <label className="text-sm font-bold sm:col-span-2">Teaser shown in the lobby (optional)<input name="blurb" maxLength={160} placeholder="Can you get a First Lady to the Red Planet?" className={inp} /></label>

    <div className="sm:col-span-2">
      <p className="text-sm font-extrabold">Rounds: pick where each one starts and where it ends</p>
      <p className="text-xs text-mute">Use 1, 3 or 5 rounds. {filled} filled{valid ? ' ✓' : ' (needs 1, 3 or 5)'}</p>
      <div className="mt-2 space-y-3">
        {pairs.map((p, i) => <div key={i} className="relative border-2 border-ink p-3">
          <p className="text-xs font-extrabold uppercase tracking-wider text-mute">Round {i + 1}</p>
          <div className="mt-1 grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <PagePicker label="FROM (start page)" value={p.start} onChange={v => set(i, { start: v })} listId={`from-${i}`} />
            <span aria-hidden="true" className="hidden pb-2 text-2xl font-black sm:block">→</span>
            <PagePicker label="TO (destination)" value={p.target} onChange={v => set(i, { target: v })} listId={`to-${i}`} />
          </div>
          <label className="mt-2 block text-sm font-bold">Caption on this round (optional)<input value={p.blurb} onChange={e => set(i, { blurb: e.target.value })} maxLength={90} className={inp} /></label>
          {pairs.length > 1 && <button type="button" aria-label={`Remove round ${i + 1}`} onClick={() => setPairs(l => l.filter((_, j) => j !== i))} className="absolute right-2 top-2 h-7 w-7 border-2 border-ink font-black hover:bg-ink hover:text-white">×</button>}
        </div>)}
      </div>
      {pairs.length < 5 && <button type="button" onClick={() => setPairs(l => [...l, { start: '', target: '', blurb: '' }])} className="mt-3 border-2 border-ink px-3 py-1.5 text-sm font-bold hover:bg-white">+ Add round</button>}
    </div>

    <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2"><input type="checkbox" name="active" defaultChecked /> Publish now (shows in the WikiRush lobby)</label>
    <div className="sm:col-span-2"><button type="submit" disabled={!valid} className="bg-ink px-5 py-2.5 font-bold text-white hover:bg-sidea disabled:opacity-50">Create challenge</button></div>
  </form>;
}
