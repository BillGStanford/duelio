'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-5 pt-8">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Something broke on our side.</h1>
      <p className="mt-3 text-lg">Your vote and your submissions are safe. Try loading the page again.</p>
      <button type="button" onClick={reset} className="mt-6 bg-ink px-5 py-3 font-bold text-white hover:bg-sidea">Try again</button>
    </main>
  );
}
