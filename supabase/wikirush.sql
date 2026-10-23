-- WikiRush accounts, public standings, streaks and referral rewards.
create extension if not exists pgcrypto;
create table if not exists public.wiki_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Trailblazer' check (char_length(display_name) between 1 and 24),
  points bigint not null default 0 check (points >= 0),
  login_streak integer not null default 0 check (login_streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  last_login_date date,
  runs_played integer not null default 0 check (runs_played >= 0),
  referral_code text unique,
  created_at timestamptz not null default now()
);
alter table public.wiki_profiles add column if not exists referral_code text;
update public.wiki_profiles set referral_code = lower(substr(replace(user_id::text, '-', ''), 1, 10)) where referral_code is null;
create unique index if not exists wiki_profiles_referral_code_unique on public.wiki_profiles(referral_code);
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
create table if not exists public.wikirush_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null,
  created_at timestamptz not null default now(),
  constraint no_self_referral check (referrer_user_id <> referred_user_id)
);
alter table public.wiki_profiles enable row level security;
alter table public.wikirush_runs enable row level security;
alter table public.wikirush_referrals enable row level security;
drop policy if exists "Public leaderboard profiles" on public.wiki_profiles;
create policy "Public leaderboard profiles" on public.wiki_profiles for select using (true);
drop policy if exists "Users can create own profile" on public.wiki_profiles;
create policy "Users can create own profile" on public.wiki_profiles for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own profile" on public.wiki_profiles;
create policy "Users can update own profile" on public.wiki_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can read own runs" on public.wikirush_runs;
create policy "Users can read own runs" on public.wikirush_runs for select using (auth.uid() = user_id);
drop policy if exists "Users can read own referrals" on public.wikirush_referrals;
create policy "Users can read own referrals" on public.wikirush_referrals for select using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id);

create or replace function public.ensure_wikirush_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare code text;
begin
  code := lower(substr(replace(new.id::text, '-', ''), 1, 10));
  insert into public.wiki_profiles(user_id, display_name, referral_code)
  values(new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'Trailblazer'), 24), code)
  on conflict(user_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created_wikirush on auth.users;
create trigger on_auth_user_created_wikirush after insert on auth.users
for each row execute procedure public.ensure_wikirush_profile();

create or replace function public.claim_wikirush_referral(p_referral_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); referrer uuid;
begin
  if uid is null or p_referral_code is null or length(p_referral_code) > 40 then return false; end if;
  select user_id into referrer from public.wiki_profiles where referral_code = lower(trim(p_referral_code));
  if referrer is null or referrer = uid then return false; end if;
  insert into public.wikirush_referrals(referrer_user_id, referred_user_id, referral_code)
  values(referrer, uid, lower(trim(p_referral_code))) on conflict(referred_user_id) do nothing;
  if not found then return false; end if;
  update public.wiki_profiles set points = points + 100 where user_id = referrer;
  update public.wiki_profiles set points = points + 100 where user_id = uid;
  return true;
end; $$;
revoke all on function public.claim_wikirush_referral(text) from public;
grant execute on function public.claim_wikirush_referral(text) to authenticated;

create or replace function public.finish_wikirush_run(
  p_points integer, p_elapsed_ms integer, p_duration_seconds integer,
  p_start_title text, p_target_title text
) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); safe_points integer;
begin
  if uid is null then raise exception 'Sign in to save a run'; end if;
  if p_duration_seconds not in (30,60,120) or p_elapsed_ms < 1000 or p_elapsed_ms > p_duration_seconds * 1000
     or p_points < 0 or p_points > 1000 or length(coalesce(p_start_title,'')) > 200
     or length(coalesce(p_target_title,'')) > 200 or lower(p_start_title) = lower(p_target_title) then
    raise exception 'Run failed validation';
  end if;
  if exists (select 1 from public.wikirush_runs where user_id = uid and created_at > now() - interval '3 seconds') then
    raise exception 'Please wait before submitting another run';
  end if;
  safe_points := least(p_points, greatest(25, 100 + floor((p_duration_seconds * 1000 - p_elapsed_ms)::numeric / 1000 * 3)::integer));
  insert into public.wikirush_runs(user_id,points,elapsed_ms,duration_seconds,start_title,target_title)
    values(uid,safe_points,p_elapsed_ms,p_duration_seconds,left(p_start_title,200),left(p_target_title,200));
  insert into public.wiki_profiles(user_id,display_name,points,runs_played,referral_code)
    values(uid,coalesce((select raw_user_meta_data->>'display_name' from auth.users where id=uid),'Trailblazer'),safe_points,1,lower(substr(replace(uid::text, '-', ''),1,10)))
    on conflict(user_id) do update set points=wiki_profiles.points+excluded.points, runs_played=wiki_profiles.runs_played+1;
end; $$;
revoke all on function public.finish_wikirush_run(integer,integer,integer,text,text) from public;
grant execute on function public.finish_wikirush_run(integer,integer,integer,text,text) to authenticated;
