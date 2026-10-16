-- Allow admins to choose which published matchups appear in the homepage hero carousel.
-- Run this migration in the Supabase SQL editor.
alter table public.duel_matchups
  add column if not exists is_featured boolean not null default false;

create index if not exists duel_matchups_featured_published_idx
  on public.duel_matchups (is_featured desc, created_at desc)
  where status = 'published';
