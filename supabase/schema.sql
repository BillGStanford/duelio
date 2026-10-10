-- Duelio schema. Run once in the Supabase SQL editor.
-- The app talks to Supabase only from the server using the service role key,
-- so row level security is enabled with no public policies (the anon key can read nothing).
-- The five editorial dilemmas are inserted automatically the first time the app runs.

create extension if not exists pgcrypto;

create table if not exists dilemmas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  question text not null,
  context text not null default '',
  side_a_label text not null,
  side_a_description text not null default '',
  side_b_label text not null,
  side_b_description text not null default '',
  status text not null default 'pending' check (status in ('pending','published','rejected','removed')),
  editorial boolean not null default false,
  submitted_by text,
  published_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  dilemma_id uuid not null references dilemmas(id) on delete cascade,
  side text not null check (side in ('a','b')),
  anonymous_identifier text not null,
  created_at timestamptz not null default now(),
  unique (dilemma_id, anonymous_identifier)
);
create index if not exists votes_dilemma_idx on votes (dilemma_id, side);
-- Group chat rooms: a room is just a short code attached to votes.
-- Existing installs: this line adds the column safely.
alter table votes add column if not exists room text;
create index if not exists votes_room_idx on votes (dilemma_id, room);
create index if not exists votes_voter_idx on votes (anonymous_identifier);
alter table votes add column if not exists voter_name text;
alter table votes add column if not exists guessed_pct_a integer check (guessed_pct_a between 0 and 100);

create table if not exists defenses (
  id uuid primary key default gen_random_uuid(),
  dilemma_id uuid not null references dilemmas(id) on delete cascade,
  anonymous_identifier text not null,
  side text not null check (side in ('a','b')),
  body text not null check (char_length(body) between 12 and 180),
  created_at timestamptz not null default now(),
  unique (dilemma_id, anonymous_identifier)
);
create index if not exists defenses_dilemma_idx on defenses (dilemma_id, created_at);

create table if not exists defense_endorsements (
  id uuid primary key default gen_random_uuid(),
  dilemma_id uuid not null references dilemmas(id) on delete cascade,
  defense_id uuid not null references defenses(id) on delete cascade,
  anonymous_identifier text not null,
  created_at timestamptz not null default now(),
  unique (defense_id, anonymous_identifier)
);
create index if not exists defense_endorsements_defense_idx on defense_endorsements (defense_id);

create table if not exists daily_dilemmas (
  daily_date date primary key,
  dilemma_id uuid not null references dilemmas(id) on delete cascade,
  closes_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists daily_dilemmas_dilemma_idx on daily_dilemmas (dilemma_id, daily_date desc);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  side_a text not null,
  side_b text not null,
  context text not null default '',
  submitter_name text not null default '',
  status text not null default 'pending' check (status in ('pending','published','rejected','removed')),
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('dilemma','discussion')),
  target_id text not null,
  reason text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now()
);

create table if not exists events (
  id bigint generated always as identity primary key,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists events_name_time_idx on events (name, created_at);

alter table dilemmas enable row level security;
alter table votes enable row level security;
alter table defenses enable row level security;
alter table defense_endorsements enable row level security;
alter table daily_dilemmas enable row level security;
alter table submissions enable row level security;
alter table reports enable row level security;
alter table events enable row level security;
