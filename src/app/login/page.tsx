import type { Metadata } from 'next';
import { Suspense } from 'react';
import AuthScreen from '@/components/game/AuthScreen';

export const metadata: Metadata = { title: 'Sign in or join', description: 'Create a free Duelio account to save your WikiRush points, level up and join the leaderboard.', robots: { index: false } };

export default function LoginPage() {
  return <Suspense fallback={<main className="gx-screen min-h-[70vh]" />}><AuthScreen /></Suspense>;
}
