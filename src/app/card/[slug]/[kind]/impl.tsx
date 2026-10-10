import { computeResults } from '@/lib/results';
import { parseFmt, roomCard, voteCard } from '@/lib/cards';
import { effectiveCloseAt } from '@/lib/daily';
import { clientIp } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { parseRoom } from '@/lib/room';
import { getStore } from '@/lib/store';
import { isValidSlug } from '@/lib/validate';
import { previousUtcDate, utcDateKey } from '@/lib/daily';

const text = (msg: string, status: number) => new Response(msg, { status });

export async function cards(req: Request, p: { slug: string; kind: string }) {
  if (!rateLimit(`card:${clientIp(req)}`, 60, 60_000)) return text('Too many requests', 429);
  const url = new URL(req.url);
  const fmt = parseFmt(url.searchParams.get('fmt'), 'square');
  if (!isValidSlug(p.slug)) return text('Not found', 404);

  const store = getStore();
  const d = await store.getDilemmaBySlug(p.slug);
  if (!d || d.status !== 'published') return text('Not found', 404);
  const today = utcDateKey();
  await store.getDailyDilemma(previousUtcDate(today));
  await store.getDailyDilemma(today);

  if (p.kind === 'a' || p.kind === 'b') {
    const counts = (await store.getCounts([d.id]))[d.id];
    const r = computeResults(counts);
    const closesAt = effectiveCloseAt(d.closesAt, await store.getLatestDailyClose(d.id));
    return voteCard({
      fmt,
      question: d.question,
      label: p.kind === 'a' ? d.sideALabel : d.sideBLabel,
      side: p.kind,
      pct: p.kind === 'a' ? r.pctA : r.pctB,
      total: r.total,
      closesAt,
    });
  }
  if (p.kind === 'room') {
    const room = parseRoom(url.searchParams.get('g'));
    const count = room ? await store.getRoomCounts(d.id, room) : { a: 0, b: 0 };
    return roomCard({ fmt, question: d.question, labelA: d.sideALabel, labelB: d.sideBLabel, count: count.a + count.b });
  }
  return text('Not found', 404);
}
