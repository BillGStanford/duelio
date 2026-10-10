import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { EventOnMount } from '@/components/PageView';
import ReportBox from '@/components/ReportBox';
import ShareBar from '@/components/ShareBar';
import GroupPanel from '@/components/GroupPanel';
import ThreadlineComments from '@/components/ThreadlineComments';
import DefenseBox from '@/components/DefenseBox';
import VoteBox from '@/components/VoteBox';
import { hashVoter, VOTER_COOKIE } from '@/lib/auth';
import { effectiveCloseAt, previousUtcDate, utcDateKey } from '@/lib/daily';
import { computeResults, isClosed } from '@/lib/results';
import { parseRoom } from '@/lib/room';
import { formatCloseDate, SITE_URL } from '@/lib/site';
import { getStore } from '@/lib/store';
import { isValidSlug } from '@/lib/validate';

export const dynamic = 'force-dynamic';

async function load(slug: string) {
  if (!isValidSlug(slug)) return null;
  return getStore().getDilemmaBySlug(slug);
}

type SP = { g?: string | string[] };

export async function generateMetadata({ params, searchParams }: { params: { slug: string }; searchParams: SP }): Promise<Metadata> {
  const d = await load(params.slug);
  if (!d || d.status !== 'published') return { title: 'Dilemma not available', robots: { index: false, follow: false } };
  const description = `${d.question} Pick a side and see where everyone lands.`;
  const url = `${SITE_URL}/d/${d.slug}`;
  const room = parseRoom(searchParams?.g);
  if (room) {
    // Group chat links get their own preview card and stay out of search results.
    const title = `Group chat verdict pending: ${d.question}`;
    const desc = 'Vote before you see what everyone else said. No sign up.';
    const image = `${SITE_URL}/card/${d.slug}/room?g=${room}`;
    return {
      title,
      description: desc,
      alternates: { canonical: url },
      robots: { index: false, follow: true },
      openGraph: { title, description: desc, url: `${url}?g=${room}`, type: 'article', siteName: 'Duelio', images: [{ url: image, width: 1200, height: 630 }] },
      twitter: { card: 'summary_large_image', title, description: desc, images: [image] },
    };
  }
  return {
    title: d.question,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { title: `${d.question} | Duelio`, description, url, type: 'article', siteName: 'Duelio' },
    twitter: { card: 'summary_large_image', title: `${d.question} | Duelio`, description },
  };
}

export default async function DebatePage({ params, searchParams }: { params: { slug: string }; searchParams: SP }) {
  const d = await load(params.slug);
  if (!d || d.status === 'pending' || d.status === 'rejected') notFound();

  if (d.status === 'removed') {
    return (
      <main className="mx-auto max-w-3xl px-5 pt-8">
        <h1 className="text-4xl font-extrabold tracking-tight">This dilemma was removed.</h1>
        <p className="mt-3 text-lg">It broke the community guidelines or was taken down by the editors.</p>
        <Link href="/" className="mt-6 inline-block bg-ink px-5 py-3 font-bold text-white hover:bg-sidea">See other dilemmas</Link>
      </main>
    );
  }

  const store = getStore();
  const today = utcDateKey();
  await store.getDailyDilemma(previousUtcDate(today));
  await store.getDailyDilemma(today);
  const dailyClose = await store.getLatestDailyClose(d.id);
  const dilemma = { ...d, closesAt: effectiveCloseAt(d.closesAt, dailyClose) };
  const closed = isClosed(dilemma);
  const cookieId = cookies().get(VOTER_COOKIE)?.value;
  const room = parseRoom(searchParams?.g);
  const voterHash = cookieId && /^[0-9a-f-]{36}$/.test(cookieId) ? hashVoter(cookieId) : null;
  const detail = voterHash ? await store.getVoteDetail(d.id, voterHash) : null;
  const voted = detail?.side ?? null;
  const inRoom = !!room && detail?.room === room;
  const roomCounts = room ? await store.getRoomCounts(d.id, room) : null;
  // Results stay hidden until the visitor has voted (or the vote has closed).
  const results = voted || closed ? computeResults((await store.getCounts([d.id]))[d.id]) : null;
  const namedVotes = results ? await store.getNamedVotes(d.id) : [];
  const crowdPrediction = results ? await store.getCrowdPrediction(d.id) : null;
  const [ownDefense, featuredDefense] = await Promise.all([
    voterHash && voted ? store.getDefense(d.id, voterHash) : null,
    closed ? store.getFeaturedDefense(d.id, voterHash) : null,
  ]);

  return (
    <main className="mx-auto max-w-3xl px-5 pb-8">
      <nav aria-label="Breadcrumb" className="pt-2 text-[0.95rem]">
        <Link href="/" className="underline underline-offset-4 hover:text-sidea">All dilemmas</Link>
        <span aria-hidden="true" className="px-2 text-mute">/</span>
        <span aria-current="page" className="text-mute">This debate</span>
      </nav>

      <p className="mt-6 text-[0.95rem] font-semibold text-mute">
        {d.editorial ? 'Editorial prompt from the Duelio team' : `Submitted by ${d.submittedBy || 'a reader'}`}
        {dilemma.closesAt && !closed ? `. Voting closes ${formatCloseDate(dilemma.closesAt)}.` : ''}
      </p>
      <h1 className="mt-2 text-[2.1rem] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl">{d.question}</h1>
      {d.context && <p className="mt-4 max-w-xl text-lg leading-relaxed text-mute">{d.context}</p>}
      <EventOnMount name="dilemma_view" props={{ slug: d.slug }} />

      <VoteBox
        key={`${d.slug}-${closed ? 'closed' : 'open'}`}
        slug={d.slug}
        question={d.question}
        room={room}
        sideA={{ label: d.sideALabel, description: d.sideADescription }}
        sideB={{ label: d.sideBLabel, description: d.sideBDescription }}
        initialVoted={voted}
        initialResults={results}
        initialNamedVotes={namedVotes}
        initialGuessedPctA={detail?.guessedPctA ?? null}
        initialCrowdPrediction={crowdPrediction}
        closesAt={dilemma.closesAt}
        closed={closed}
      />

      {room && roomCounts && (
        <GroupPanel
          key={`${room}-${voted ?? 'none'}-${inRoom}-${roomCounts.a + roomCounts.b}`}
          slug={d.slug}
          room={room}
          labelA={d.sideALabel}
          labelB={d.sideBLabel}
          initial={{ total: roomCounts.a + roomCounts.b, voted: !!voted, inRoom, results: inRoom ? computeResults(roomCounts) : null }}
        />
      )}

      <ShareBar slug={d.slug} question={d.question} room={room} />

      <section aria-labelledby="discussion-heading" className="mt-10 border-t-4 border-ink pt-6">
        <h2 id="discussion-heading" className="text-3xl font-extrabold tracking-tight">Join the discussion</h2>
        <p className="mt-2 text-lg leading-relaxed text-mute">Share your take or reply to someone else&apos;s.</p>
        <p className="my-5 border-l-4 border-sidea bg-white px-4 py-3 text-lg font-bold leading-relaxed">
          What would change your answer?
        </p>
        <ThreadlineComments slug={d.slug} />
      </section>

      <DefenseBox
        slug={d.slug}
        hasVoted={!!voted}
        sideALabel={d.sideALabel}
        sideBLabel={d.sideBLabel}
        closed={closed}
        initialDefense={ownDefense}
        featuredDefense={featuredDefense}
      />

      <ReportBox slug={d.slug} />
    </main>
  );
}
