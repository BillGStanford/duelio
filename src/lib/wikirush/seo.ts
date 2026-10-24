// Search and social metadata for WikiRush, kept as data so it can be tested and reused by pages.
import { SITE_URL } from '../site';

export const WR_TITLE = 'WikiRush: The Wikipedia Link Race Game | Play Free';
export const WR_DESCRIPTION = 'WikiRush is a free Wikipedia game. Get from one page to another using only links, beat the clock, climb the daily leaderboard and challenge friends. No download. The GeoGuessr of Wikipedia.';

export const WR_KEYWORDS = [
  'WikiRush', 'Wiki Rush', 'WikiRush game', 'Wikipedia game', 'Wikipedia race', 'wikiracing', 'wiki race game',
  'Wikipedia link game', 'Wikipedia speedrun', 'wiki game online', 'GeoGuessr for Wikipedia', 'Wikipedia daily challenge', 'Duelio',
];

export type Faq = { q: string; a: string };

export const WR_FAQ: readonly Faq[] = [
  { q: 'What is WikiRush?', a: 'WikiRush is a free browser game by Duelio where you race from one Wikipedia article to another using only the links inside the articles. It is wikiracing with a daily challenge, a leaderboard and shareable results.' },
  { q: 'How do you play WikiRush?', a: 'You are shown a start page and a destination page. Click links inside the article text to hop between pages until you reach the destination before the timer runs out. Fewer clicks and faster times score more points, up to 5,000 per round.' },
  { q: 'Is WikiRush free?', a: 'Yes. Your first game needs no account. After that, a free account saves your progress, scores and streaks, and puts you on the leaderboard.' },
  { q: 'Is there a daily WikiRush challenge?', a: 'Yes. Everyone in the world gets the same five rounds each day, like a Wordle for Wikipedia. Share your score and compare with friends.' },
  { q: 'Can I record my WikiRush game?', a: 'Yes. Turn on recording before you start and WikiRush captures the run with a branded overlay, then pops up the finished video with a Download button when the game ends. It is made for TikTok, Reels, Shorts and streams.' },
  { q: 'Can streamers play WikiRush?', a: 'Yes. Streamer mode hides personal details, makes a chat-ready challenge link so viewers can play the exact same pages, and works full screen in OBS.' },
  { q: 'Is WikiRush affiliated with Wikipedia?', a: 'No. WikiRush by Duelio is an independent game that uses article text from Wikipedia under CC BY-SA 4.0 and is not affiliated with the Wikimedia Foundation.' },
];

export function faqJsonLd(faq: readonly Faq[] = WR_FAQ) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

export function gameJsonLd(base: string = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: 'WikiRush',
    alternateName: ['Wiki Rush', 'WikiRush by Duelio'],
    description: WR_DESCRIPTION,
    url: `${base}/wikirush`,
    image: `${base}/wikirush/wr-og.png`,
    genre: ['Puzzle', 'Trivia', 'Wikipedia game'],
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any (web browser)',
    gamePlatform: 'Web browser',
    playMode: ['SinglePlayer', 'MultiPlayer'],
    inLanguage: 'en',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: 'Duelio', url: base },
  };
}

export function siteJsonLd(base: string = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Duelio',
    alternateName: 'WikiRush by Duelio',
    url: base,
  };
}
