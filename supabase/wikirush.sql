-- WikiRush profile and score ledger. Run in the Supabase SQL editor.
create table if not exists public.wiki_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Trailblazer' check (char_length(display_name) between 1 and 24),
  points bigint not null default 0 check (points >= 0),
  login_streak integer not null default 0 check (login_streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  last_login_date date,
  runs_played integer not null default 0 check (runs_played >= 0),
  created_at timestamptz not null default now()
);
create table if not exists public.wikirush_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  points integer not null check (points between 0 and 1000),
  elapsed_ms integer not null check (elapsed_ms between 1 and 120000),
  duration_seconds integer not null check (duration_seconds in (30,60,120)),
  start_title text not null,
  target_title text not null,
  created_at timestamptz not null default now()
);
alter table public.wiki_profiles enable row level security;
alter table public.wikirush_runs enable row level security;
drop policy if exists "Public leaderboard profiles" on public.wiki_profiles;
create policy "Public leaderboard profiles" on public.wiki_profiles for select using (true);
drop policy if exists "Users can create own profile" on public.wiki_profiles;
create policy "Users can create own profile" on public.wiki_profiles for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own profile" on public.wiki_profiles;
create policy "Users can update own profile" on public.wiki_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can read own runs" on public.wikirush_runs;
create policy "Users can read own runs" on public.wikirush_runs for select using (auth.uid() = user_id);
-- Scores are written only through this RPC. Enforce plausible elapsed time and cap points.
create or replace function public.finish_wikirush_run(
  p_points integer, p_elapsed_ms integer, p_duration_seconds integer,
  p_start_title text, p_target_title text
) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); safe_points integer;
begin
  if uid is null then raise exception 'Sign in to save a run'; end if;
  if p_duration_seconds not in (30,60,120) or p_elapsed_ms < 1000 or p_elapsed_ms > p_duration_seconds * 1000
     or p_points < 0 or p_points > 1000 or length(coalesce(p_start_title,'')) > 200
     or length(coalesce(p_target_title,'')) > 200 or p_start_title = p_target_title then
    raise exception 'Run failed validation';
  end if;
  -- One run per 3 seconds prevents trivial rapid-fire score farming.
  if exists (select 1 from public.wikirush_runs where user_id = uid and created_at > now() - interval '3 seconds') then
    raise exception 'Please wait before submitting another run';
  end if;
  safe_points := least(p_points, greatest(25, 100 + floor((p_duration_seconds * 1000 - p_elapsed_ms)::numeric / 1000 * 3)::integer));
  insert into public.wikirush_runs(user_id,points,elapsed_ms,duration_seconds,start_title,target_title)
    values(uid,safe_points,p_elapsed_ms,p_duration_seconds,left(p_start_title,200),left(p_target_title,200));
  insert into public.wiki_profiles(user_id,display_name,points,runs_played)
    values(uid,coalesce((select raw_user_meta_data->>'display_name' from auth.users where id=uid),'Trailblazer'),safe_points,1)
    on conflict(user_id) do update set points=wiki_profiles.points+excluded.points, runs_played=wiki_profiles.runs_played+1;
end; $$;
revoke all on function public.finish_wikirush_run(integer,integer,integer,text,text) from public;
grant execute on function public.finish_wikirush_run(integer,integer,integer,text,text) to authenticated;
