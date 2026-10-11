'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { track } from '@/lib/analytics';
import { verdictLine } from '@/lib/results';
import { formatCloseDate } from '@/lib/site';
import type { CrowdPrediction, Results, Side } from '@/lib/types';
import TakeCard from './TakeCard';
import VoteShare from './VoteShare';
import ShareBar from './ShareBar';

interface SideInfo {
  label: string;
  description: string;
}
interface Props {
  slug: string;
  question: string;
  room: string | null;
  sideA: SideInfo;
  sideB: SideInfo;
  initialVoted: Side | null;
  initialResults: Results | null;
  initialNamedVotes: { name: string; side: Side }[];
  initialGuessedPctA: number | null;
  initialCrowdPrediction: CrowdPrediction | null;
  closesAt: string | null;
  closed: boolean;
}

function Panel(props: {
  side: Side;
  info: SideInfo;
  pct: number | null;
  count: number | null;
  selected: boolean;
  interactive: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  const { side, info, pct, count, selected, interactive, disabled, onPick } = props;
  const bg = side === 'a' ? 'bg-sidea' : 'bg-sideb';
  const badgeText = side === 'a' ? 'text-sidea' : 'text-sideb';
  const cls = `${bg} relative flex min-h-[9.5rem] w-full flex-col justify-between p-5 text-left text-white sm:min-h-[12rem] sm:p-6 ${
    selected ? 'outline outline-4 outline-offset-4 outline-ink' : ''
  }`;
  const inner = (
    <>
      <span>
        <span className="flex items-center justify-between gap-2">
          <span aria-hidden="true" className={`grid h-7 w-7 place-items-center bg-white text-base font-extrabold ${badgeText}`}>
            {side === 'a' ? 'A' : 'B'}
          </span>
          {selected && <span className="bg-white px-2 py-1 text-sm font-bold text-ink">✓ Your pick</span>}
        </span>
        <span className="mt-3 block text-3xl font-extrabold leading-none tracking-tight sm:text-4xl">{info.label}</span>
        <span className="mt-2 block text-base leading-snug">{info.description}</span>
      </span>
      {pct !== null && (
        <span className="mt-4 block">
          <span className="block text-5xl font-extrabold leading-none tracking-tight">{pct}%</span>
          {count !== null && <span className="text-sm">{count} {count === 1 ? 'vote' : 'votes'}</span>}
        </span>
      )}
    </>
  );
  if (!interactive) return <div className={cls}>{inner}</div>;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-label={`Pick ${info.label}: ${info.description}`}
      className={`${cls} transition-transform enabled:hover:-translate-y-1 enabled:active:translate-y-0 disabled:cursor-wait disabled:opacity-80 motion-reduce:transition-none`}
    >
      {inner}
    </button>
  );
}

export default function VoteBox({
  slug,
  question,
  room,
  sideA,
  sideB,
  initialVoted,
  initialResults,
  initialNamedVotes,
  initialGuessedPctA,
  initialCrowdPrediction,
  closesAt,
  closed,
}: Props) {
  const router = useRouter();
  const [voted, setVoted] = useState<Side | null>(initialVoted);
  const [results, setResults] = useState<Results | null>(initialResults);
  const [namedVotes, setNamedVotes] = useState(initialNamedVotes);
  const [guessedPctA, setGuessedPctA] = useState(initialGuessedPctA ?? 50);
  const [hasGuessed, setHasGuessed] = useState(initialGuessedPctA !== null);
  const [hasGuess, setHasGuess] = useState(initialGuessedPctA !== null);
  const [crowdPrediction, setCrowdPrediction] = useState(initialCrowdPrediction);
  const [voterName, setVoterName] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [barA, setBarA] = useState(initialResults ? initialResults.pctA : 50);

  useEffect(() => {
    if (!results) return;
    const id = requestAnimationFrame(() => setBarA(results.pctA));
    return () => cancelAnimationFrame(id);
  }, [results]);

  const labelOf = (s: Side) => (s === 'a' ? sideA.label : sideB.label);
  const showResults = !!results;
  const hasVotes = !!results && results.total > 0;

  async function pick(side: Side) {
    if (pending || voted || closed) return;
    setPending(true);
    setError('');
    track('vote_started', { slug, side });
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, side, room, voterName: voterName.trim() || null, guessedPctA }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'We couldn\u2019t record that vote. Try again.');
        return;
      }
      setBarA(50);
      setVoted(data.side);
      setResults(data.results);
      setNamedVotes(data.namedVotes);
      setCrowdPrediction(data.crowdPrediction);
      setHasGuess(data.guessedPctA !== null);
      if (data.guessedPctA !== null) setGuessedPctA(data.guessedPctA);
      setMessage(
        data.duplicate
          ? `You already picked ${labelOf(data.side)}. Votes can\u2019t be changed.`
          : `You picked ${labelOf(data.side)}.`,
      );
      if (!data.duplicate) track('vote_completed', { slug, side: data.side });
      if (data.secondDilemma) track('second_dilemma_vote', { slug });
      router.refresh();
    } catch {
      setError('We couldn\u2019t record that vote. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="vote-heading" className="mt-0">
      <h2 id="vote-heading" className="sr-only">
        {closed ? 'Final result' : voted ? 'Current result' : 'Pick a side'}
      </h2>

      {closed && results && (
        <div className="mb-4">
          <p className="text-3xl font-extrabold tracking-tight">The vote is in.</p>
          <p className="mt-1 text-lg">{verdictLine(results, { sideALabel: sideA.label, sideBLabel: sideB.label })}</p>
        </div>
      )}

      {!voted && !closed && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="mb-3">
            <label htmlFor="voter-name" className="font-bold">Vote with a name <span className="font-normal text-mute">(optional)</span></label>
            <input
              id="voter-name"
              name="voterName"
              value={voterName}
              onChange={(event) => setVoterName(event.target.value)}
              maxLength={32}
              autoComplete="nickname"
              className="mt-1 w-full border-2 border-ink bg-white p-3 text-base"
              placeholder="Your nickname"
            />
            <p className="mt-1 text-xs text-mute">No account needed. Your nickname and side are public.</p>
          </div>
          <div className="mb-3 border-l-4 border-sideb bg-white px-3 py-2">
            <label htmlFor="crowd-guess" className="font-bold">Predict the crowd</label>
            <p className="text-xs text-mute">What percentage will choose {sideA.label}?</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-sm font-bold">0%</span>
              <input
                id="crowd-guess"
                type="range"
                min="0"
                max="100"
                step="1"
                value={guessedPctA}
                onPointerDown={() => setHasGuessed(true)}
                onKeyDown={() => setHasGuessed(true)}
                onChange={(event) => {
                  setGuessedPctA(Number(event.target.value));
                  setHasGuessed(true);
                }}
                className="w-full accent-sidea"
              />
              <span className="min-w-12 text-right text-lg font-extrabold">{guessedPctA}%</span>
            </div>
            {!hasGuessed && <p className="mt-2 text-sm font-semibold text-sideb">Move the slider to lock in your prediction before voting.</p>}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2" aria-busy={pending}>
        <Panel
          side="a"
          info={sideA}
          pct={showResults && hasVotes ? results!.pctA : null}
          count={showResults && hasVotes ? results!.a : null}
          selected={voted === 'a'}
          interactive={!voted && !closed}
          disabled={pending || (!voted && !closed && !hasGuessed)}
          onPick={() => pick('a')}
        />
        <Panel
          side="b"
          info={sideB}
          pct={showResults && hasVotes ? results!.pctB : null}
          count={showResults && hasVotes ? results!.b : null}
          selected={voted === 'b'}
          interactive={!voted && !closed}
          disabled={pending || (!voted && !closed && !hasGuessed)}
          onPick={() => pick('b')}
        />
      </div>

      {showResults && (
        <div className="mt-5">
          <div
            role="img"
            aria-label={
              hasVotes
                ? `${results!.pctA}% ${sideA.label}, ${results!.pctB}% ${sideB.label}`
                : 'No votes yet'
            }
            className="flex h-5 w-full overflow-hidden bg-rule"
          >
            {hasVotes && (
              <>
                <div className="h-full bg-sidea transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${barA}%` }} />
                <div className="h-full flex-1 bg-sideb" />
              </>
            )}
          </div>
          <p className="mt-2 flex flex-wrap justify-between gap-2 text-base font-semibold">
            {hasVotes ? (
              <>
                <span>{results!.pctA}% {sideA.label}</span>
                <span className="font-normal text-mute">{results!.total} {results!.total === 1 ? 'vote' : 'votes'}</span>
                <span>{results!.pctB}% {sideB.label}</span>
              </>
            ) : (
              <span className="font-normal text-mute">Nobody has picked a side yet.</span>
            )}
          </p>
        </div>
      )}

      {showResults && results && (
        <ShareBar
          slug={slug}
          question={question}
          room={room}
          side={voted}
          labelA={sideA.label}
          labelB={sideB.label}
          results={results}
        />
      )}

      {showResults && namedVotes.length > 0 && (
        <div className="mt-5 border-l-4 border-sidea bg-white px-4 py-3">
          <h3 className="font-extrabold">Votes by name</h3>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {namedVotes.map((vote, index) => (
              <li key={`${vote.name}-${vote.side}-${index}`}>{vote.name} picked {labelOf(vote.side)}</li>
            ))}
          </ul>
        </div>
      )}

      {showResults && results && crowdPrediction && crowdPrediction.count > 0 && (
        <div className="mt-4 border-l-4 border-sideb bg-white px-4 py-3">
          <p className="font-extrabold">Before seeing the result, voters guessed</p>
          <p className="mt-1 text-mute">
            {crowdPrediction.averagePctA}% for {sideA.label} · {100 - crowdPrediction.averagePctA}% for {sideB.label}
            {hasGuess
              ? ` — your guess was ${guessedPctA}% for ${sideA.label}, and the actual split was ${results.pctA}%.`
              : '.'}
          </p>
        </div>
      )}

      <div aria-live="polite" className="mt-4 min-h-[1.5rem]">
        {message && (
          <>
            <p className="text-xl font-bold">{message}</p>
            {!closed && <p className="mt-1 text-mute">Now defend it. Read the case for each side below, or make yours.</p>}
          </>
        )}
        {!message && voted && !closed && <p className="text-xl font-bold">You picked {labelOf(voted)}.</p>}
        {!voted && !closed && !error && <p className="text-mute">Pick a side to see where everyone lands.</p>}
      </div>
      {error && (
        <p role="alert" className="mt-2 border-l-4 border-sideb bg-white px-3 py-2 font-medium">
          {error}
        </p>
      )}

      {closesAt && !closed && (
        <p className="mt-3 text-sm font-semibold text-mute">Voting closes {formatCloseDate(closesAt)}.</p>
      )}
      {voted && <VoteShare slug={slug} side={voted} label={labelOf(voted)} question={question} closesAt={closesAt} />}
      {voted && <TakeCard refreshKey={`${slug}-${voted}`} />}
    </section>
  );
}
