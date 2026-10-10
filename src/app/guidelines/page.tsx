import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Community guidelines',
  description: 'How Duelio keeps disagreements playful: what to post, what to leave out, and how to report problems.',
  alternates: { canonical: '/guidelines' },
};

const banned = [
  'Doxxing or any personal identifying information',
  'Harassment, threats, or hate speech',
  'Accusations against identifiable private people',
  'Private screenshots or conversations posted without permission',
  'Medical diagnosis disputes, legal advice, or financial advice',
  'Sexual content involving minors',
  'Targeted political persuasion',
  'Instructions for wrongdoing',
];

export default function Guidelines() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-8 pt-6">
      <h1 className="text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">Keep it playful.</h1>
      <p className="mt-4 text-lg leading-relaxed">
        Duelio is for small, low-stakes disagreements: roommates, relationships, friends, food, internet etiquette, harmless work etiquette. Argue hard about the question. Be decent to the people answering it.
      </p>
      <h2 className="mt-10 text-2xl font-extrabold tracking-tight">Not allowed in dilemmas or discussions</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-lg">
        {banned.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <h2 className="mt-10 text-2xl font-extrabold tracking-tight">Reporting</h2>
      <p className="mt-3 text-lg leading-relaxed">
        Every debate page has a report link under the discussion. Use it for the dilemma itself or for a comment. For a comment, say who wrote it and quote a few words so we can find it. Submitted dilemmas are reviewed by a person before they appear. Dilemmas that break these rules are removed.
      </p>
      <p className="mt-8">
        <Link href="/submit" className="inline-block bg-ink px-5 py-3 font-bold text-white hover:bg-sidea">Submit a dilemma</Link>
      </p>
    </main>
  );
}
