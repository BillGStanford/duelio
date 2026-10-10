import { adminEnabled } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  '1': 'That password is not right.',
  rate: 'Too many attempts. Wait 15 minutes.',
  disabled: 'Admin is turned off. Set ADMIN_PASSWORD in your environment variables.',
};

export default function AdminLogin({ searchParams }: { searchParams: { error?: string } }) {
  const err = searchParams.error ? ERRORS[searchParams.error] : null;
  return (
    <main className="mx-auto max-w-md px-5 pt-6">
      <h1 className="text-4xl font-extrabold tracking-tight">Editor sign in</h1>
      {!adminEnabled() && <p className="mt-3 border-l-4 border-sideb bg-white px-3 py-2">{ERRORS.disabled}</p>}
      {err && adminEnabled() && <p role="alert" className="mt-3 border-l-4 border-sideb bg-white px-3 py-2 font-medium">{err}</p>}
      <form method="post" action="/api/admin/login" className="mt-6 space-y-4">
        <div>
          <label htmlFor="password" className="font-bold">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="mt-1 w-full border-2 border-ink bg-white p-3" />
        </div>
        <button type="submit" className="bg-ink px-6 py-3 font-bold text-white hover:bg-sidea">Sign in</button>
      </form>
    </main>
  );
}
