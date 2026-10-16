'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DuelRound, DuelSide, Matchup } from '@/lib/matchups';
import VoteShare from './VoteShare';
import ThreadlineComments from './ThreadlineComments';

type Counts = { a: number; b: number };
type Champion = { roundNumber: number; winnerSide: DuelSide | 'tie'; votesA: number; votesB: number; closedAt: string } | null;
type Snapshot = { matchup: Matchup; round: DuelRound; counts: Counts; history: DuelRound[]; champion: Champion; votedSide: DuelSide | null; showWinnerAnimation: boolean };
function Portrait({ src, name, large = false }: { src: string; name: string; large?: boolean }) {
  const [image, setImage] = useState(src || `/api/entity-image?name=${encodeURIComponent(name)}`);
  useEffect(() => setImage(src || `/api/entity-image?name=${encodeURIComponent(name)}`), [src, name]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt={name} onError={() => { const fallback = `/api/entity-image?name=${encodeURIComponent(name)}`; if (image !== fallback) setImage(fallback); }}
      className={`${large ? 'h-56 sm:h-72' : 'h-20'} w-full rounded-xl border border-rule bg-[#f5f6fa] object-contain object-center`}
      style={{ objectFit: 'contain', objectPosition: 'center' }} />
  );
}
function percent(n: number, total: number) { return total ? Math.round(n / total * 100) : 50; }
function formatRemaining(iso: string, now: number) {
  const ms = Math.max(0, Date.parse(iso) - now);
  const days = Math.floor(ms / 86400000), hours = Math.floor(ms % 86400000 / 3600000);
  const mins = Math.floor(ms % 3600000 / 60000), secs = Math.floor(ms % 60000 / 1000);
  return days ? `${days}d ${hours}h left` : `${hours}h ${mins}m ${secs}s left`;
}
export default function MatchupExperience({ initial }: { initial: Snapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const snapshotRef = useRef(initial);
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [expandedInfo, setExpandedInfo] = useState<{ a: boolean; b: boolean }>({ a: false, b: false });
  const [crowdOpen, setCrowdOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [ticker, setTicker] = useState('LIVE · Vote totals refresh automatically.');
  const [winnerStage, setWinnerStage] = useState<'title' | 'card' | null>(initial.showWinnerAnimation ? 'title' : null);
  const total = snapshot.counts.a + snapshot.counts.b;
  const pctA = percent(snapshot.counts.a, total), pctB = 100 - pctA;
  const championSide = snapshot.champion?.winnerSide === 'a' || snapshot.champion?.winnerSide === 'b' ? snapshot.champion.winnerSide : null;
  const refresh = useCallback(async (showActivity = true) => {
    try {
      const response = await fetch(`/api/matchups/${encodeURIComponent(snapshot.matchup.slug)}`, { cache: 'no-store' });
      if (!response.ok) return;
      const next = await response.json() as Snapshot;
      const previous = snapshotRef.current;
      const previousTotal = previous.counts.a + previous.counts.b;
      const nextTotal = next.counts.a + next.counts.b;
      const deltaA = next.counts.a - previous.counts.a;
      const deltaB = next.counts.b - previous.counts.b;
      if (showActivity && next.round.id === previous.round.id && (deltaA > 0 || deltaB > 0)) {
        if (deltaA > 0 && deltaB === 0) setTicker(`🔥 ${deltaA} new vote${deltaA === 1 ? '' : 's'} rallied for ${next.matchup.nameA}!`);
        else if (deltaB > 0 && deltaA === 0) setTicker(`🔥 ${deltaB} new vote${deltaB === 1 ? '' : 's'} rallied for ${next.matchup.nameB}!`);
        else setTicker(`🔥 ${nextTotal - previousTotal} new votes came in. ${next.matchup.nameA}: ${percent(next.counts.a, nextTotal)}% · ${next.matchup.nameB}: ${percent(next.counts.b, nextTotal)}%.`);
      }
      if (next.round.roundNumber > previous.round.roundNumber && previous.round.id !== next.round.id) {
        setWinnerStage('title');
        setTicker('🏆 The previous round has closed. A new round is live.');
      }
      snapshotRef.current = next;
      setSnapshot(next);
    } catch { /* Keep the last good snapshot if the connection drops. */ }
  }, [snapshot.matchup.slug]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const refreshTimer = window.setInterval(() => { void refresh(); }, 8000);
    let revealTimer: number | undefined;
    if (winnerStage === 'title') revealTimer = window.setTimeout(() => setWinnerStage('card'), 1650);
    if (winnerStage === 'card') revealTimer = window.setTimeout(() => setWinnerStage(null), 3400);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(refreshTimer);
      if (revealTimer) window.clearTimeout(revealTimer);
    };
  }, [refresh, winnerStage]);
  const vote = async (side: DuelSide) => {
    if (busy || snapshot.votedSide) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/matchups/${encodeURIComponent(snapshot.matchup.slug)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ side, roundId: snapshot.round.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || 'Vote not recorded.');
        if (result.refresh) await refresh(false);
        return;
      }
      setSnapshot(previous => ({ ...previous, counts: result.counts, votedSide: result.side }));
      setTicker(result.duplicate ? 'You already voted in this round.' : `🔥 Your vote is in for ${side === 'a' ? snapshot.matchup.nameA : snapshot.matchup.nameB}!`);
      setMessage(result.duplicate ? 'Your vote for this round was already recorded.' : 'Vote recorded. Share your pick and rally your people.');
    } catch { setMessage('We could not record that vote. Please try again.'); }
    finally { setBusy(false); }
  };
  const shareSide = snapshot.votedSide;
  const latestClosedRound = snapshot.history.find(r => r.status === 'closed');
  const winnerName = latestClosedRound?.winnerSide === 'a' ? snapshot.matchup.nameA : latestClosedRound?.winnerSide === 'b' ? snapshot.matchup.nameB : null;
  const winnerImage = latestClosedRound?.winnerSide === 'a' ? snapshot.matchup.imageA : latestClosedRound?.winnerSide === 'b' ? snapshot.matchup.imageB : '';
  const winnerDescription = latestClosedRound?.winnerSide === 'a' ? snapshot.matchup.descriptionA : latestClosedRound?.winnerSide === 'b' ? snapshot.matchup.descriptionB : '';
  const history = useMemo(() => snapshot.history.filter(r => r.status === 'closed').slice(0, 12), [snapshot.history]);
  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
      {winnerStage && winnerName && (
        <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex items-center justify-center bg-[#11172a]/95 p-5 text-center text-white backdrop-blur-sm">
          {winnerStage === 'title' ? (
            <div className="winner-reveal w-full max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.32em] text-[#b8c0ff]">The previous round is decided</p>
              <h2 className="mt-4 text-6xl font-black tracking-tight sm:text-8xl">THE WINNER</h2>
              <p className="mt-5 text-3xl font-black sm:text-5xl">{winnerName}</p>
              <p className="mt-4 text-sm text-[#d6d9ff]">A champion has been recorded. The next round is live.</p>
            </div>
          ) : (
            <div className="winner-reveal w-full max-w-md rounded-2xl border-2 border-[#7d8aff] bg-white p-5 text-ink shadow-[0_0_70px_rgba(36,51,224,0.35)] sm:p-7">
              <span className="inline-flex rounded-full bg-sidea px-5 py-2 text-xs font-black tracking-[0.2em] text-white">WINNER</span>
              <Portrait src={winnerImage} name={winnerName} large />
              <h2 className="mt-4 text-3xl font-black sm:text-4xl">{winnerName}</h2>
              <p className="mt-2 text-sm leading-relaxed text-mute">{winnerDescription}</p>
              <p className="mt-4 text-xs font-extrabold uppercase tracking-widest text-sidea">Round {latestClosedRound?.roundNumber} winner</p>
            </div>
          )}
        </div>
      )}
      <nav aria-label="Breadcrumb" className="pt-3 text-sm"><a href="/#matchups" className="font-bold underline underline-offset-4 hover:text-sidea">Matchup board</a><span className="px-2 text-mute">/</span><span className="text-mute">{snapshot.matchup.nameA} vs {snapshot.matchup.nameB}</span></nav>
      <header className="mt-5 rounded-2xl border border-rule border-t-4 border-t-sidea bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-[#f2f3ff] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-sidea">Public matchup</span>
          <span className="rounded-full border border-rule px-3 py-1 text-xs font-bold text-mute">ROUND {snapshot.round.roundNumber}</span>
        </div>
        <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-5xl">{snapshot.matchup.nameA} <span className="text-sidea">vs.</span> {snapshot.matchup.nameB}</h1>
        <p className="mt-3 max-w-2xl text-mute">Two sides. One public verdict. Vote, make your case, and share the matchup to bring your people into the debate.</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
          <span className="inline-flex items-center gap-2 rounded-full bg-paper px-3 py-2"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> LIVE VOTING</span>
          <span className="rounded-full bg-paper px-3 py-2">{formatRemaining(snapshot.round.closesAt, now)}</span>
          <span className="rounded-full bg-paper px-3 py-2">{total.toLocaleString()} votes this round</span>
        </div>
      </header>
      <section aria-label="Competitors and voting" className="mt-5 grid items-stretch gap-4 sm:grid-cols-2">
        <section aria-label="Round information" className="order-3 flex flex-col rounded-2xl border border-rule bg-white p-4 shadow-sm sm:col-span-2 sm:row-start-2 sm:p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-sidea">Round {snapshot.round.roundNumber}</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">The public verdict</h2>
          <p className="mt-2 text-sm leading-relaxed text-mute">Two sides. One community decision. Cast your vote, see the split, and build your case below.</p>
          <div className="mt-5 rounded-xl bg-paper p-3"><p className="text-xs font-black uppercase tracking-wider text-mute">Voting closes in</p><p className="mt-1 text-lg font-black">{formatRemaining(snapshot.round.closesAt, now)}</p></div>
          <div className="mt-4 flex items-center justify-between gap-2 text-xs font-black"><span className="text-sidea">{pctA}%</span><span className="text-mute">{total.toLocaleString()} votes</span><span className="text-sideb">{pctB}%</span></div>
          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-paper"><span className="bg-sidea" style={{ width: (pctA + "%") }} /><span className="bg-sideb" style={{ width: (pctB + "%") }} /></div>
          <div className="mt-5 rounded-xl border border-rule p-3" aria-live="polite"><p className="text-xs font-black uppercase tracking-widest text-sidea">Live update</p><p className="mt-1 text-sm font-semibold leading-relaxed">{ticker}</p><p className="mt-2 text-xs text-mute">Vote totals refresh automatically.</p></div>
          <a href="#community-case-building" className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-4 py-3 text-center font-black text-white hover:bg-sidea">Join the discussion ↓</a>
        </section>
        {(['a','b'] as DuelSide[]).map(side => {
          const isA = side === 'a';
          const name = isA ? snapshot.matchup.nameA : snapshot.matchup.nameB;
          const image = isA ? snapshot.matchup.imageA : snapshot.matchup.imageB;
          const votes = isA ? snapshot.counts.a : snapshot.counts.b;
          const pct = isA ? pctA : pctB;
          const champion = championSide === side;
          const picked = snapshot.votedSide === side;
          return (
            <article key={side} className={`relative flex h-full flex-col order-1 md:row-start-1 overflow-hidden rounded-2xl border-t-4 bg-white p-4 shadow-sm transition sm:p-5 ${isA ? "border-t-sidea sm:col-start-1 sm:row-start-1 sm:order-1" : "order-2 border-t-sideb sm:col-start-2 sm:row-start-1 sm:order-2"} ${champion ? 'border-2 border-[#2433E0] ring-4 ring-[#2433E0]/10' : 'border-rule'}`}>
              {champion && <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-[#2433E0] px-3 py-2 text-xs font-black tracking-[0.14em] text-white shadow-md"><span>♛ REIGNING CHAMPION</span><span>ROUND {snapshot.champion?.roundNumber}</span></div>}
              {picked && <div className="mb-3 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black tracking-[0.14em] text-white">YOUR PICK ✓</div>}
              <Portrait src={image} name={name} large />
              <div className="mt-4 flex items-start justify-between gap-3"><h2 className="text-2xl font-black tracking-tight">{name}</h2><span className={`shrink-0 rounded-full px-3 py-1 text-sm font-black ${isA ? 'bg-[#f2f3ff] text-sidea' : 'bg-[#fff1f4] text-sideb'}`}>{pct}%</span></div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-paper"><div className={`h-full rounded-full transition-all duration-500 ${isA ? 'bg-sidea' : 'bg-sideb'}`} style={{ width: `${pct}%` }} /></div>
              <p className="mt-2 text-sm font-semibold text-mute">{votes.toLocaleString()} vote{votes === 1 ? '' : 's'}</p>
              <button type="button" onClick={() => vote(side)} disabled={busy || !!snapshot.votedSide} className={`mt-auto mt-4 min-h-12 w-full rounded-xl px-4 py-3 font-black text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${isA ? 'bg-sidea hover:brightness-90' : 'bg-sideb hover:brightness-90'}`}>{snapshot.votedSide ? (picked ? 'You voted for this' : 'Vote recorded') : busy ? 'Recording vote…' : `I vote for ${name}`}</button>
            </article>
          );
        })}
      </section>
      <section aria-label="Contender background information" className="mt-5 grid gap-4 md:grid-cols-2">
        {(['a', 'b'] as DuelSide[]).map((side) => {
          const isA = side === 'a';
          const name = isA ? snapshot.matchup.nameA : snapshot.matchup.nameB;
          const description = isA ? snapshot.matchup.descriptionA : snapshot.matchup.descriptionB;
          const source = isA ? snapshot.matchup.sourceUrlA : snapshot.matchup.sourceUrlB;
          const expanded = expandedInfo[side];
          return <article key={side} className={"overflow-hidden rounded-2xl border border-rule border-t-4 " + (isA ? "border-t-sidea" : "border-t-sideb") + " bg-white p-5 shadow-sm sm:p-6"}>
            <div className="flex items-center justify-between gap-3"><div><p className={"text-xs font-black uppercase tracking-[0.15em] " + (isA ? "text-sidea" : "text-sideb")}>{isA ? "Blue side · A" : "Red side · B"} · Background</p><h2 className="mt-1 text-xl font-black tracking-tight">{name}</h2></div><button type="button" aria-expanded={expanded} onClick={() => setExpandedInfo(previous => ({ ...previous, [side]: !previous[side] }))} className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl font-black " + (isA ? "bg-[#eef0ff] text-sidea" : "bg-[#fff0f4] text-sideb")}><span aria-hidden="true">{expanded ? "−" : "+"}</span><span className="sr-only">{expanded ? "Collapse" : "Expand"} background information for {name}</span></button></div>
            <div className={"relative mt-4 " + (expanded ? "" : "max-h-28 overflow-hidden")}>
              <p className={"text-sm leading-7 text-mute " + (expanded ? "" : "line-clamp-4 blur-[1.5px]")}>{description || ("Background information for " + name + " has not been added yet.")}</p>
              {!expanded && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-white/10 via-white/80 to-white" />}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3"><button type="button" onClick={() => setExpandedInfo(previous => ({ ...previous, [side]: !previous[side] }))} className="text-sm font-extrabold underline underline-offset-4">{expanded ? "Show less" : "Read background"}</button>{source && <a href={source} target="_blank" rel="noreferrer" className={"text-xs font-bold underline underline-offset-4 " + (isA ? "text-sidea" : "text-sideb")}>Wikipedia / source ↗</a>}</div>
          </article>;
        })}
      </section>
      <section className="mt-5 overflow-hidden rounded-2xl border border-rule bg-white shadow-sm">
        <button
          type="button"
          aria-expanded={crowdOpen}
          aria-controls="crowd-vote-details"
          onClick={() => setCrowdOpen(open => !open)}
          className="flex w-full cursor-pointer items-center justify-between gap-4 p-5 text-left sm:p-6"
        >
          <span>
            <span className="block text-xs font-black uppercase tracking-[0.16em] text-sidea">The crowd</span>
            <span className="mt-1 block text-xl font-black">Where the vote stands</span>
            <span className="mt-1 block text-sm font-semibold text-mute">{total.toLocaleString()} total votes · {pctA}% Blue / {pctB}% Red</span>
          </span>
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center border border-rule bg-paper text-2xl font-black">{crowdOpen ? '−' : '+'}</span>
        </button>
        {crowdOpen && (
          <div id="crowd-vote-details" className="border-t border-rule px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
            <div className="flex h-4 overflow-hidden bg-[#fff1f4]"><span className="bg-sidea transition-all duration-500" style={{ width: `${pctA}%` }} /><span className="bg-sideb transition-all duration-500" style={{ width: `${pctB}%` }} /></div>
            <div className="mt-3 flex justify-between gap-3 text-sm font-black"><span className="text-sidea">{snapshot.matchup.nameA}: {pctA}%</span><span className="text-right text-sideb">{snapshot.matchup.nameB}: {pctB}%</span></div>
            {message && <p role="status" className="mt-4 bg-paper p-3 text-sm font-semibold">{message}</p>}
          </div>
        )}
      </section>
      {shareSide && <section aria-labelledby="your-link-card-heading" className="mt-5 rounded-2xl border border-rule border-t-4 border-t-sidea bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-sidea">Your vote is in</p><h2 id="your-link-card-heading" className="mt-1 text-2xl font-black">Your Link Card</h2></div><span aria-hidden="true" className="text-2xl font-black text-sidea">↓</span></div>
        <p className="mt-2 text-sm leading-relaxed text-mute">Your share card is ready below. Choose a format to download or share it.</p>
        <VoteShare slug={snapshot.matchup.slug} side={shareSide} label={shareSide === 'a' ? snapshot.matchup.nameA : snapshot.matchup.nameB} question={`${snapshot.matchup.nameA} vs. ${snapshot.matchup.nameB}`} closesAt={snapshot.round.closesAt} shareUrl={`/matchup/${snapshot.matchup.slug}`} matchup={{ nameA: snapshot.matchup.nameA, nameB: snapshot.matchup.nameB }} />
      </section>}
      <section className="mt-6 rounded-2xl border border-rule bg-white p-5 sm:p-7">
        <h2 className="text-2xl font-black">Round history</h2><p className="mt-1 text-sm text-mute">Every result stays on this page. A new round opens automatically every 14 days.</p>
        {history.length ? <ol className="mt-4 space-y-3">{history.map(r => {
          const winName = r.winnerSide === 'a' ? snapshot.matchup.nameA : r.winnerSide === 'b' ? snapshot.matchup.nameB : 'Tie';
          const winImage = r.winnerSide === 'a' ? snapshot.matchup.imageA : r.winnerSide === 'b' ? snapshot.matchup.imageB : '';
          return <li key={r.id} className="flex items-center gap-3 rounded-xl border border-rule p-3"><div className="w-16 shrink-0"><Portrait src={winImage} name={winName} /></div><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-widest text-mute">Round {r.roundNumber} · Final</p><p className="font-extrabold">{winName === 'Tie' ? 'Round ended in a tie' : `${winName} won`}</p><p className="text-sm text-mute">{r.votesA} for {snapshot.matchup.nameA} · {r.votesB} for {snapshot.matchup.nameB}</p></div><span className="text-xs font-bold text-mute">{r.closedAt ? new Date(r.closedAt).toLocaleDateString() : ''}</span></li>;
        })}</ol> : <p className="mt-4 rounded-xl bg-paper p-4 text-mute">No completed rounds yet. The first champion will be recorded when this round closes.</p>}
      </section>
      <section id="community-case-building" aria-labelledby="community-case-heading" className="mt-8 min-w-0 rounded-2xl border border-rule border-t-4 border-t-ink bg-white p-5 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-sidea">Community case-building</p>
        <h2 id="community-case-heading" className="mt-2 text-3xl font-black tracking-tight">Make the argument.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-mute">The vote shows the split. Threadline is where the community builds its case.</p>
        <div className="mt-6 min-w-0"><ThreadlineComments slug={`matchup-${snapshot.matchup.slug}`} /></div>
      </section>
      <p className="mt-6 text-center text-xs text-mute">Duelio measures the people who vote here—not a scientific or representative poll.</p>
    </div>
  );
}
