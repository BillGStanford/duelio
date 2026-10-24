// Hand-picked opening rounds. A player's first few games use these so the first thing they see is
// something funny and instantly familiar ("Melania Trump to Mars") instead of two random obscure
// pages. Every title is a famous, well-linked English Wikipedia article.
import { seededRng } from './rng';
import { START_POOL, TARGET_POOL } from './pools';
import type { RoundPlan } from './rounds';

export type StarterPair = { start: string; target: string; blurb: string };

export const STARTER_PAIRS: readonly StarterPair[] = [
  // Starter game 0: the welcome run
  { start: 'Melania Trump', target: 'Mars', blurb: 'From the White House to the Red Planet.' },
  { start: 'Taylor Swift', target: 'Ancient Egypt', blurb: 'The Eras Tour meets the pharaohs.' },
  { start: 'Mickey Mouse', target: 'Moon', blurb: 'A cartoon mouse goes to space.' },
  // Starter game 1
  { start: 'Pizza', target: 'Elon Musk', blurb: 'Dinner to billionaire in a few hops.' },
  { start: 'Beyoncé', target: 'Antarctica', blurb: 'Queen Bey, meet the penguins.' },
  { start: 'SpongeBob SquarePants', target: 'Roman Empire', blurb: 'Bikini Bottom to the Colosseum.' },
  // Starter game 2
  { start: 'Cristiano Ronaldo', target: 'Pizza', blurb: 'Goals to dough.' },
  { start: 'Spider-Man', target: 'Eiffel Tower', blurb: 'A web-slinger takes a Paris vacation.' },
  { start: 'Barbie', target: 'Saturn', blurb: 'Dream House to ringed planet.' },
  // Starter game 3 and beyond (used by longer games and friend challenges)
  { start: 'Darth Vader', target: 'Japan', blurb: 'The Dark Side goes on holiday.' },
  { start: 'Pikachu', target: 'Mount Everest', blurb: 'Static electricity at 8,849 metres.' },
  { start: 'Lionel Messi', target: 'Sahara', blurb: 'A football legend in the desert.' },
  { start: 'Justin Bieber', target: 'Great Wall of China', blurb: 'Pop star, ancient wall.' },
  { start: 'Shrek', target: 'Statue of Liberty', blurb: 'An ogre arrives in New York.' },
  { start: 'Michael Jackson', target: 'Tokyo', blurb: 'Moonwalk to Shibuya.' },
  { start: 'LeBron James', target: 'Photosynthesis', blurb: 'Slam dunk to plant science.' },
  { start: 'Oprah Winfrey', target: 'Volcano', blurb: 'You get a volcano! And you get a volcano!' },
  { start: 'Kim Kardashian', target: 'Amazon River', blurb: 'Reality TV to the rainforest.' },
];

/** How many opening games get the hand-picked treatment before play switches to the random pools. */
export const STARTER_GAMES = 3;
const ROUNDS_PER_STARTER_GAME = 3;

const STARTER_SEED = /^starter-(\d{1,3})$/;

export function starterSeed(index: number): string {
  return `starter-${Math.max(0, Math.floor(index))}`;
}

export function parseStarterSeed(seed: string | undefined | null): number | null {
  const m = STARTER_SEED.exec(seed || '');
  return m ? Number(m[1]) : null;
}

/** The seed a player should get for their Nth game (0-based), or null once they have outgrown the starters. */
export function starterSeedForGame(gamesPlayed: number): string | null {
  return gamesPlayed >= 0 && gamesPlayed < STARTER_GAMES ? starterSeed(gamesPlayed) : null;
}

/** Deterministic plans for a starter game. Fallback alternates come from the random pools. */
export function starterPlans(index: number, count: number): RoundPlan[] {
  const rounds = Math.max(1, Math.min(5, Math.floor(count)));
  const rng = seededRng(`starter-alts:${index}`);
  const pick = (pool: readonly string[]) => [pool[Math.floor(rng() * pool.length)], pool[Math.floor(rng() * pool.length)]];
  return Array.from({ length: rounds }, (_, i) => {
    const pair = STARTER_PAIRS[(index * ROUNDS_PER_STARTER_GAME + i) % STARTER_PAIRS.length];
    return { start: pair.start, target: pair.target, blurb: pair.blurb, startAlts: pick(START_POOL), targetAlts: pick(TARGET_POOL) };
  });
}
