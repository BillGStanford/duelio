import type { Metadata } from 'next';
import SubmitForm from '@/components/SubmitForm';

export const metadata: Metadata = {
  title: 'Submit a dilemma',
  description: 'Got an argument your group chat can\u2019t settle? Submit it and share it with the Duelio community.',
  alternates: { canonical: '/submit' },
};

export default function SubmitPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-8 pt-6">
      <h1 className="text-4xl font-extrabold leading-tight tracking-[-0.03em] sm:text-5xl">Got an argument your group chat can&apos;t settle?</h1>
      <p className="mb-8 mt-3 text-lg text-mute">Write the question, then give each side its best one-line case. Published dilemmas appear in the main feed right away.</p>
      <SubmitForm />
    </main>
  );
}
