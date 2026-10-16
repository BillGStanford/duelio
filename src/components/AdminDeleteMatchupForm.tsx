'use client';

export default function AdminDeleteMatchupForm({ id, nameA, nameB }: { id: string; nameA: string; nameB: string }) {
  return (
    <form method="post" action="/api/admin/matchups" onSubmit={(event) => {
      if (!window.confirm(`Permanently delete "${nameA} vs. ${nameB}" and all its rounds and votes? This cannot be undone.`)) event.preventDefault();
    }}>
      <input type="hidden" name="action" value="delete" />
      <input type="hidden" name="id" value={id} />
      <button className="rounded-lg border border-sideb px-3 py-2 text-sm font-bold text-sideb hover:bg-[#fff1f4]" type="submit">Delete permanently</button>
    </form>
  );
}
