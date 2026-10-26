-- WikiRush v2: multi-round games, Daily Challenge ranking, server-side score recomputation.
-- Safe to re-run. Run AFTER supabase/wikirush.sql.

create table if not exists public.wikirush_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('daily','classic','wild','challenge')),
  seed text check (seed is null or char_length(seed) <= 40),
  rounds integer not null check (rounds in (1,3,5)),
  seconds integer not null check (seconds in (45,90,180)),
  total integer not null check (total between 0 and 25000),
  results jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists wikirush_games_seed_total on public.wikirush_games(seed, total desc) where mode = 'daily';
create index if not exists wikirush_games_user on public.wikirush_games(user_id, created_at desc);
-- One ranked attempt per player per daily seed; replays are accepted as practice (see the function).
create unique index if not exists wikirush_games_daily_once on public.wikirush_games(user_id, seed) where mode = 'daily';

alter table public.wikirush_games enable row level security;
drop policy if exists "Users can read own games" on public.wikirush_games;
create policy "Users can read own games" on public.wikirush_games for select using (auth.uid() = user_id);
-- No insert/update policies: games are written only through submit_wikirush_game().

-- Public, read-only daily board: display names and totals only.
create or replace view public.wikirush_daily_board as
  select p.display_name, g.total, g.seed, g.created_at
  from public.wikirush_games g
  join public.wiki_profiles p on p.user_id = g.user_id
  where g.mode = 'daily';
grant select on public.wikirush_daily_board to anon, authenticated;

create or replace function public.wikirush_round_score(p_won boolean, p_elapsed_ms integer, p_limit_ms integer, p_clicks integer, p_radar boolean, p_near boolean)
returns integer language plpgsql immutable as $$
declare speed integer; eff integer; left_ms integer;
begin
  if not p_won then return case when p_near then 600 else 0 end; end if;
  left_ms := greatest(0, p_limit_ms - least(p_limit_ms, greatest(0, p_elapsed_ms)));
  speed := floor(2000::numeric * left_ms / p_limit_ms)::integer;
  eff := 100 * least(10, greatest(0, 12 - greatest(1, p_clicks)));
  return greatest(0, 2000 + speed + eff - case when p_radar then 600 else 0 end);
end; $$;

create or replace function public.submit_wikirush_game(
  p_mode text, p_seed text, p_rounds integer, p_seconds integer, p_results jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r jsonb; total integer := 0; s integer; won boolean; el integer; ck integer; limit_ms integer;
  pts integer; ranked boolean := true; n integer := 0;
begin
  if uid is null then raise exception 'Sign in to save a game'; end if;
  if p_mode not in ('daily','classic','wild','challenge') or p_rounds not in (1,3,5) or p_seconds not in (45,90,180) then
    raise exception 'Game failed validation';
  end if;
  if p_mode = 'daily' and (p_rounds <> 5 or p_seconds <> 90 or p_seed is null or p_seed <> 'daily-' || to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD')) then
    raise exception 'Daily game failed validation';
  end if;
  if jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) <> p_rounds then raise exception 'Game failed validation'; end if;
  if exists (select 1 from public.wikirush_games where user_id = uid and created_at > now() - interval '8 seconds') then
    raise exception 'Please wait before submitting another game';
  end if;
  limit_ms := p_seconds * 1000;
  for r in select * from jsonb_array_elements(p_results) loop
    won := coalesce((r->>'won')::boolean, false);
    el := least(limit_ms, greatest(0, coalesce((r->>'elapsed_ms')::integer, limit_ms)));
    ck := least(60, greatest(0, coalesce((r->>'clicks')::integer, 0)));
    if won and (ck < 1 or el < 120 * ck) then raise exception 'Round failed validation'; end if;
    s := public.wikirush_round_score(won, el, limit_ms, ck, coalesce((r->>'radar')::boolean, false), coalesce((r->>'near')::boolean, false));
    total := total + s; n := n + 1;
  end loop;
  begin
    insert into public.wikirush_games(user_id, mode, seed, rounds, seconds, total, results)
    values (uid, p_mode, left(p_seed, 40), p_rounds, p_seconds, total, p_results);
  exception when unique_violation then
    ranked := false; -- a second daily is practice: no points, no board entry
  end;
  pts := case when ranked then total / 10 else 0 end;
  if pts > 0 then
    insert into public.wiki_profiles(user_id, display_name, points, runs_played, referral_code)
      values (uid, coalesce((select left(raw_user_meta_data->>'display_name', 24) from auth.users where id = uid), 'Trailblazer'), pts, p_rounds, lower(substr(replace(uid::text, '-', ''), 1, 10)))
      on conflict (user_id) do update set points = wiki_profiles.points + excluded.points, runs_played = wiki_profiles.runs_played + p_rounds;
  end if;
  return jsonb_build_object('total', total, 'points', pts, 'ranked', ranked);
end; $$;
revoke all on function public.submit_wikirush_game(text, text, integer, integer, jsonb) from public;
grant execute on function public.submit_wikirush_game(text, text, integer, integer, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Guest gate: one free game per browser/device before an account is required.
-- Only the server (service role) touches this table. Keys are salted hashes, never raw IPs.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.wikirush_guest_claims (
  key text primary key,
  created_at timestamptz not null default now()
);
alter table public.wikirush_guest_claims enable row level security; -- no policies: service role only

-- ---------------------------------------------------------------------------------------------
-- Detail challenges: hand-built FROM -> TO rounds created on the admin desk (/admin/wikirush).
-- Server (service role) writes; the public reads active ones through /api/wikirush/featured.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.wikirush_featured (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 60),
  blurb text not null default '' check (char_length(blurb) <= 160),
  pairs jsonb not null,
  seconds integer not null default 90 check (seconds in (45,90,180)),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.wikirush_featured enable row level security; -- no policies: service role only
alter table public.wikirush_featured add column if not exists day integer; -- "Day N Challenge" release number

-- Optional avatar choice (1-12) shown on the leaderboard. The app works without it.
alter table public.wiki_profiles add column if not exists avatar smallint;
