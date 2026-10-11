# Duelio

**The internet disagrees with you.** Duelio is a small web experiment. Visitors see a low-stakes everyday dilemma with two sides, pick one, see where everyone landed, read or join the discussion, and share the question.

It tests one hypothesis: people will share a specific everyday disagreement, invite others to weigh in, and take part in a public discussion about it. See `EXPERIMENT.md` for how to judge that.

## What is in the box

- Homepage with a shared dilemma of the day, a 24-hour vote window, and yesterday's public reveal. Daily assignments are persisted so visitors see the same prompt.
- Searchable main feed includes every published dilemma. The top three dilemmas with at least 10 votes and the closest qualifying dead heat are also featured above the list without disappearing from it.
- Seven editorial dilemmas provide one week of daily prompts before the rotation repeats. Existing installs with the original five prompts receive the two new starters once by slug; existing content and votes are preserved.
- A permanent page per dilemma at `/d/<slug>`: a straightforward prompt and voting panel, followed by the group-room tally when applicable, discussion, and report. After voting, the image card preview is open on the page rather than hidden in a dropdown.
- Results stay hidden until you vote (or the vote closes). One vote per browser.
- After the result reveal, one prominent group-chat share button sends a prewritten message and creates a live group tally. Three copy variants are randomly tested and their started/completed rates are shown in `/admin`.
- Daily dilemmas close at midnight UTC after their featured day. Closed dilemmas show "The vote is in." and the final crowd verdict (never "X is correct"). Editors can still set an earlier close time.
- Voting is still open to everyone, including the submitter. Voters may optionally attach a public nickname to a vote; no account is required and unnamed votes remain anonymous.
- Before voting, visitors predict what percentage will choose side A. Their guess is saved with their one-time vote; the aggregate prediction appears only with the result. After voting, each visitor can post one short case for the side they did not choose. When the vote closes, the most-endorsed defense is featured; endorsements are one per voter and cannot be cast on your own defense.
- Dilemmas with at least 10 votes and a 45–55 split receive a dead-heat badge; the closest split is pinned above the homepage list. The three highest-vote dilemmas with at least 10 votes are also pinned, and all pinned dilemmas remain in the full list. The discussion opens with the prompt, "What would change your answer?"
- `/submit`: public dilemma submissions. Valid submissions are published immediately, appear in the searchable homepage feed, and get a shareable dilemma page.
- `/admin`: editor desk (create, edit, publish, unpublish, remove, set closing date, review submissions, resolve reports, 7-day metrics).
- `/guidelines`: community rules.
- Social previews: Open Graph and Twitter tags plus generated 1200×630 share images for the homepage and every dilemma. A dilemma preview shows its question and current vote split; social platforms may cache that split. Vercel deployments use `https://duelio.ink` by default; set `NEXT_PUBLIC_SITE_URL` when attaching a different custom domain.
- Discussion by the Threadline embed.
- The share loop (below): vote cards, group chat rooms, and a "how often do you side with the crowd" take.

Not built on purpose: profiles, followers, feeds, streaks, leaderboards, AI judges, notifications.

## The share loop

1. **Vote card.** After you vote, you get a card with your pick ("I picked Split evenly. Do you agree?") and the live percentage. Pick a size, then share. On phones it opens the native share sheet with the image attached. On a computer it saves the PNG.

   | Size | Pixels | Good for |
   | --- | --- | --- |
   | Story 9:16 | 1080 x 1920 | Instagram, TikTok, Reels, WhatsApp status |
   | Feed post 4:5 | 1080 x 1350 | Instagram and Facebook feed |
   | Square 1:1 | 1080 x 1080 | iMessage, WhatsApp, any post |
   | Link card 1.91:1 | 1200 x 630 | X, Facebook, LinkedIn (also the link preview image) |

   Vote cards show the closing time when one is set. Every card (vote, group chat, take, and each dilemma's preview) uses the same look: a soft paper background with faint blue and pink glows, a hairline frame, a bold serif headline centered on the card, and small labels. Text is measured against the real font and sized to fit, so long questions shrink and wrap evenly instead of overflowing, and very long text ends in an ellipsis. Image URL pattern: `/card/<slug>/a?fmt=story|portrait|square|wide` (use `b` for side B, `room?g=<code>` for the group card).
2. **Settle it in your group chat.** One button creates a group link (`/d/<slug>?g=<code>`) and opens the share sheet, or copies it. Everyone who votes through that link is counted in the group. The link preview in iMessage, WhatsApp, Slack, and similar apps reads "Group chat verdict pending" with the question and how many votes are in. The page shows the group's own split live (it refreshes every 8 seconds). The split is shown only to people who voted in that group. Everyone else sees just how many have voted. Chat apps cache previews, so the vote count on a preview can lag.
3. **Your take.** After you vote on enough debates, you see how often you sided with the majority and can share it as a card. A debate counts once 3 people have voted and one side leads. You need 3 counted debates. No account is needed: it uses the same anonymous cookie as voting, so clearing cookies resets it.

Group codes are random labels, not secrets. Anyone with a link can vote in that group, and anyone can invent a code. A public voter nickname is optional; when supplied, it is displayed next to that person's side. It is not a verified identity, and voters can choose a different nickname on another dilemma.

Choices made on purpose: results are never locked behind sharing, and there are no email or push notifications, because both would pull in personal data and consent handling this experiment doesn't need. Group chats get a live tally instead.

The homepage illustration is a local SVG asset, so it does not depend on an external image-generation or image-hosting service. On Windows, `postinstall` also applies a narrow URL-resolution compatibility fix to Next.js's bundled `@vercel/og` renderer; without it, generated share cards fail to render because Node's Windows path joining corrupts the renderer's bundled font and WASM URLs.

Upgrading an existing Supabase project: run the full `supabase/schema.sql` again. Its `create table if not exists` and `alter table ... add column if not exists` statements add the daily schedule, public nickname and crowd-prediction fields, plus defense and endorsement tables, without removing existing data. The app requires those schema updates before deployment.

## Stack

Next.js 14 (App Router) + TypeScript, Tailwind CSS, Supabase Postgres for production data, Threadline embed for discussion, Vercel for hosting. No web fonts and no animation libraries.

## Run it locally (2 minutes)

Requires Node 18.18 or newer.

```bash
npm install
npm run dev          # http://localhost:3000
```

This zip already contains a `.env.local` with the Threadline values and a generated admin password. With no Supabase variables set, Duelio stores data in `.data/duelio.json`. That is for development and single-server hosting only.

Admin: open `/admin`, sign in with `ADMIN_PASSWORD` from `.env.local`. Admin is switched off if that variable is empty.

## Environment variables

Copy `.env.example` to `.env.local` and fill it in.

| Variable | Needed | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_THREADLINE_SITE_ID` | yes | Threadline site id. Public by design (it appears in the page HTML). |
| `NEXT_PUBLIC_THREADLINE_API_URL` | yes | Threadline comments API URL. The redirecting `threadline.ink/api` alias is normalized to its direct API host. |
| `NEXT_PUBLIC_THREADLINE_EMBED_SRC` | yes | Threadline embed script URL. |
| `NEXT_PUBLIC_SITE_URL` | in production | Public URL without trailing slash, used for canonical and social URLs. |
| `ADMIN_PASSWORD` | for /admin | Editor password. Choose a long one. |
| `ADMIN_SESSION_SECRET` | optional | Signs the admin cookie. Defaults to `ADMIN_PASSWORD`. |
| `VOTE_SALT` | recommended | Salt for hashing anonymous voter ids. Use a long random string. |
| `NEXT_PUBLIC_SUPABASE_URL` | production | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | production | Server only. Never expose it to the browser. |
| `NEXT_PUBLIC_ANALYTICS_ID` | optional | Reserved for connecting an analytics provider (see Analytics). |

`NEXT_PUBLIC_*` values are baked into the browser bundle at build time, so changing one means rebuilding.

## Threadline discussion

`src/components/ThreadlineComments.tsx` loads the Threadline embed with `next/script`, reading the three `NEXT_PUBLIC_THREADLINE_*` variables. The API URL is normalized to avoid redirecting CORS preflights. If a variable is missing or the script fails to load, the page shows "The discussion is unavailable right now. Your vote still counts." and keeps working.

Threadline provides the discussion only (comments, replies, reactions, comment moderation). Voting, submissions, reports, and analytics are Duelio's own.

Two things the embed snippet does not document, so check them on your deployed site before you rely on them:

1. **One thread per dilemma.** The embed gets no page id from Duelio. Threadline most likely keys threads by page URL. Open two dilemmas and confirm their comments are separate.
2. **Navigation between dilemmas.** The script tag id includes the dilemma slug so Next.js re-runs the embed after client-side navigation. If a thread fails to appear after clicking from one dilemma to another, tell Threadline or switch dilemma links to full page loads.

The "Be the first person to make the case" line is shown above the embed on every dilemma. Duelio cannot tell whether a thread has comments, so it does not hide that line.

## Production setup (Vercel + Supabase)

1. Create a Supabase project. In the SQL editor, run `supabase/schema.sql`.
2. Create a Vercel project from this folder (push it to Git, or run `npx vercel`).
3. In Vercel, add every variable from the table above, including the Supabase pair and `NEXT_PUBLIC_SITE_URL`.
4. Deploy. On first request the seven editorial dilemmas are inserted into the empty `dilemmas` table.
5. Open `/admin` on the live site, sign in, and check the storage line says "Supabase".

Do not deploy to Vercel without Supabase. The JSON file store would live in temporary storage and lose votes.

Row level security is enabled on every table with no public policies, so the Supabase anon key can read nothing. The app only talks to Supabase from the server, using the service role key.

## Moderation workflow

- New public submissions are validated and published immediately with standard Yes/No labels. Editors can unpublish or remove them from `/admin`; legacy submissions waiting for review can still be approved or rejected there.
- Dilemma states: `pending` (hidden), `published`, `rejected`, `removed` (page shows a removal notice).
- Visitors report from any debate page, choosing "This dilemma" or "A comment in the discussion". Reports appear in `/admin` under "Open reports". Press Mark resolved when handled.
- Comment moderation itself happens in Threadline. Duelio only collects reports about comments, and reporters are asked to name the author and quote a few words.
- Submissions containing links, email addresses, or phone numbers are rejected automatically.

## Analytics

Duelio records these events into your own database and shows 7-day counts in `/admin`: page views, dilemma views, vote started and completed, share clicked and completed, group chats created and joined, vote cards and takes shared, submission started and completed, report submitted, and discussion script loaded. Share completion is only measured for the native share sheet and for copying the link, because the browser cannot see where a link is pasted.

`src/lib/analytics.ts` is the adapter. To connect a provider, add its snippet so it creates `window.dataLayer`, and every event is mirrored there. Comment and reply activity inside Threadline is not visible to Duelio, so read it in Threadline's own dashboard.

## Tests

```bash
npm test             # 35 unit tests: results math, validation, store, rooms, crowd take, card text fitting
npm run typecheck
npm run build && npm run start
npm run smoke        # 88 end-to-end checks, including every card size against a running server (set ADMIN_PASSWORD)
```

`npm run smoke` expects a fresh data store (delete `.data/` first) because it casts votes.

## Security notes

- All input is validated on the server. Vote counts are always computed on the server.
- Voting uses an anonymous cookie. Only a salted hash of it is stored. This stops casual repeat voting. It is not fraud-proof: clearing cookies or using another browser allows another vote.
- Rate limits are kept in memory per server instance, so on serverless hosting they are best-effort.
- State-changing requests reject cross-site origins. Admin uses an HttpOnly, SameSite cookie.
- React escapes all user text. No raw HTML is ever rendered.
- No Content-Security-Policy is set, because it would need Threadline's exact origins. Add one once confirmed.

## Changing the card look

- Backgrounds are generated images in `src/assets/bg-<tone>-<size>.jpg`. Edit the colours or glows in `scripts/make-backgrounds.py` and run `python3 scripts/make-backgrounds.py` (needs `pip install pillow numpy`).
- Fonts are bundled in `src/assets` (see `FONT-LICENSE.txt`): Pagella Bold for headlines, Poppins Bold for small labels. The Pagella copy has its optional ligature table removed because the image renderer cannot read it.
- Sizes, margins and maximum type sizes live in `SPEC` in `src/lib/cards.tsx`. Text fitting lives in `src/lib/textFit.ts`.
- Card text uses only characters the font can draw. Emoji and unusual symbols are dropped from card images (the website itself shows them fine).

## Replacing the seed content

The editorial dilemmas live in `src/lib/seed.ts`. They are inserted only into an empty database. Afterward, manage dilemmas in `/admin`.

## Project map

```
src/app/            pages and API routes (/, /d/[slug], /submit, /guidelines, /admin, /api/*)
src/components/     VoteBox, ShareBar, ReportBox, SubmitForm, ThreadlineComments, DuelStrip
src/lib/            validation, results math, auth, rate limit, analytics, seed, card images and text fitting
src/lib/store/      Store interface, JSON file store, Supabase store
supabase/schema.sql database schema
scripts/            background image generator
tests/              unit tests and the end-to-end smoke script
```
