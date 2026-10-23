# WikiRush production setup

1. In the Supabase SQL Editor, run `supabase/wikirush.sql`. It is safe to rerun and preserves existing WikiRush profile/run data.
2. In **Authentication → Sign In / Providers → Email**, turn off **Confirm email** to allow email + password sign-up without an email confirmation step. This is a Supabase project setting; application code cannot override it. Keep password authentication enabled.
3. In Vercel Project Settings → Environment Variables, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the environments you deploy, then redeploy so the public browser client is built with them. Never put a service-role key in a `NEXT_PUBLIC_*` variable or browser code.
4. Verify signup, sign-in, profile editing, referral claims, a completed trail, and the public leaderboard.

## Referral flow

A referral link uses `/?ref=CODE`. During signup, WikiRush saves the code with the account metadata and claims the referral once after authentication. The database's unique referred-user constraint prevents repeated bonuses. Each qualifying referral grants 100 points to the inviter and new player. Typing a code manually is also supported in the account form.

## Important limitations

Wikipedia is loaded through its public MediaWiki APIs because Wikipedia pages do not permit arbitrary third-party sites to iframe the live site. WikiRush renders a controlled, full-screen, Wikipedia-inspired reading view with navigation links and a persistent timer overlay. This does not impersonate Wikipedia login or collect Wikipedia credentials.

Score validation enforces duration/elapsed bounds and a server-side points cap. It is not a fully authoritative route verifier; a determined client can still fabricate a plausible trail. Add server-side MediaWiki route verification before treating points as high-stakes.
