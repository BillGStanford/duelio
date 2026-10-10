import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-5 pt-8">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">That dilemma isn&apos;t here.</h1>
      <p className="mt-3 text-lg">The link may be wrong, or the dilemma hasn&apos;t been published yet.</p>
      <Link href="/" className="mt-6 inline-block bg-ink px-5 py-3 font-bold text-white hover:bg-sidea">See all dilemmas</Link>
    </main>
  );
}
