-- Permanent crowd-created matchups for Duelio.
-- Run this migration in the Supabase SQL editor before deploying the feature.
create extension if not exists pgcrypto;

create table if not exists duel_matchups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  canonical_key text not null unique,
  name_a text not null,
  name_b text not null,
  description_a text not null default '',
  description_b text not null default '',
  image_a text not null default '',
  image_b text not null default '',
  source_url_a text not null default '',
  source_url_b text not null default '',
  status text not null default 'published' check (status in ('published','removed')),
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lower(name_a) <> lower(name_b))
);

create table if not exists duel_rounds (
  id uuid primary key default gen_random_uuid(),
  matchup_id uuid not null references duel_matchups(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  starts_at timestamptz not null default now(),
  closes_at timestamptz not null default (now() + interval '14 days'),
  closed_at timestamptz,
  status text not null default 'active' check (status in ('active','closed')),
  winner_side text check (winner_side in ('a','b','tie')),
  votes_a integer not null default 0,
  votes_b integer not null default 0,
  created_at timestamptz not null default now(),
  unique (matchup_id, round_number)
);
create unique index if not exists duel_rounds_one_active_idx
  on duel_rounds (matchup_id) where status = 'active';
create index if not exists duel_rounds_matchup_history_idx
  on duel_rounds (matchup_id, round_number desc);

create table if not exists duel_votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references duel_rounds(id) on delete cascade,
  voter_hash text not null,
  side text not null check (side in ('a','b')),
  created_at timestamptz not null default now(),
  unique (round_id, voter_hash)
);
create index if not exists duel_votes_round_side_idx on duel_votes (round_id, side);

-- Lock the matchup row so two visitors arriving after the deadline cannot
-- accidentally create two new rounds or close the same round twice.
create or replace function duel_ensure_active_round(p_matchup_id uuid)
returns setof duel_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  m duel_matchups%rowtype;
  r duel_rounds%rowtype;
  next_number integer;
  a_count integer;
  b_count integer;
  winner text;
begin
  select * into m from duel_matchups where id = p_matchup_id for update;
  if not found or m.status <> 'published' then return; end if;

  select * into r from duel_rounds
    where matchup_id = p_matchup_id and status = 'active'
    order by round_number desc limit 1 for update;

  if not found then
    select coalesce(max(round_number), 0) + 1 into next_number
      from duel_rounds where matchup_id = p_matchup_id;
    insert into duel_rounds (matchup_id, round_number, starts_at, closes_at, status)
      values (p_matchup_id, next_number, now(), now() + interval '14 days', 'active')
      returning * into r;
  elsif r.closes_at <= now() then
    select count(*) filter (where side = 'a'), count(*) filter (where side = 'b')
      into a_count, b_count from duel_votes where round_id = r.id;
    winner := case when a_count > b_count then 'a'
                   when b_count > a_count then 'b' else 'tie' end;
    update duel_rounds set status = 'closed', closed_at = now(),
      votes_a = a_count, votes_b = b_count, winner_side = winner where id = r.id;
    next_number := r.round_number + 1;
    insert into duel_rounds (matchup_id, round_number, starts_at, closes_at, status)
      values (p_matchup_id, next_number, now(), now() + interval '14 days', 'active')
      returning * into r;
  end if;
  return query select * from duel_rounds where id = r.id;
end;
$$;

-- Admin-only callers use the server service-role client. Closes the active
-- round immediately, records the result and opens the next two-week round.
create or replace function duel_admin_close_round(p_matchup_id uuid)
returns setof duel_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  r duel_rounds%rowtype;
  a_count integer;
  b_count integer;
  next_number integer;
begin
  perform 1 from duel_matchups where id = p_matchup_id for update;
  select * into r from duel_rounds where matchup_id = p_matchup_id
    and status = 'active' order by round_number desc limit 1 for update;
  if not found then
    return query select * from duel_ensure_active_round(p_matchup_id);
    return;
  end if;
  select count(*) filter (where side = 'a'), count(*) filter (where side = 'b')
    into a_count, b_count from duel_votes where round_id = r.id;
  update duel_rounds set status = 'closed', closed_at = now(),
    votes_a = a_count, votes_b = b_count,
    winner_side = case when a_count > b_count then 'a'
                       when b_count > a_count then 'b' else 'tie' end
    where id = r.id;
  next_number := r.round_number + 1;
  insert into duel_rounds (matchup_id, round_number, starts_at, closes_at, status)
    values (p_matchup_id, next_number, now(), now() + interval '14 days', 'active')
    on conflict (matchup_id, round_number) do nothing;
  return query select * from duel_rounds where matchup_id = p_matchup_id and status = 'active';
end;
$$;

alter table duel_matchups enable row level security;
alter table duel_rounds enable row level security;
alter table duel_votes enable row level security;
-- No public policies: reads and writes go through the Duelio server using
-- SUPABASE_SERVICE_ROLE_KEY, never a browser-side privileged key.

-- Only the server-side service role may invoke mutating security-definer RPCs.
revoke all on function duel_ensure_active_round(uuid) from public, anon, authenticated;
revoke all on function duel_admin_close_round(uuid) from public, anon, authenticated;
grant execute on function duel_ensure_active_round(uuid) to service_role;
grant execute on function duel_admin_close_round(uuid) to service_role;

-- Atomically validate the round deadline and enforce one vote per browser hash.
create or replace function duel_cast_vote(p_round_id uuid, p_voter_hash text, p_side text)
returns table(closed boolean, duplicate boolean, side text)
language plpgsql
security definer
set search_path = public
as $$
declare
  r duel_rounds%rowtype;
  inserted_side text;
  was_duplicate boolean := false;
begin
  if p_side not in ('a','b') then raise exception 'Invalid side'; end if;
  select * into r from duel_rounds where id = p_round_id for update;
  if not found or r.status <> 'active' or r.closes_at <= now() then
    return query select true, false, null::text;
    return;
  end if;
  insert into duel_votes (round_id, voter_hash, side) values (p_round_id, p_voter_hash, p_side)
    on conflict (round_id, voter_hash) do nothing returning duel_votes.side into inserted_side;
  if not found then
    was_duplicate := true;
    select v.side into inserted_side from duel_votes v where v.round_id = p_round_id and v.voter_hash = p_voter_hash;
  end if;
  return query select false, was_duplicate, inserted_side;
end;
$$;
revoke all on function duel_cast_vote(uuid, text, text) from public, anon, authenticated;
grant execute on function duel_cast_vote(uuid, text, text) to service_role;
