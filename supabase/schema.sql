-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor) to set up backup/sync.
-- 1. Run the sessions table + RLS below.
-- 2. In Dashboard → Storage, create a bucket named "images" (private).
-- 3. In Storage → Policies for bucket "images", add the policy at the bottom (or run it in SQL Editor).

-- Sessions table (one row per drawing session, scoped by user)
create table if not exists public.sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at bigint not null,
  updated_at bigint not null,
  reference_image_id text not null,
  drawing_image_id text not null,
  compare_mode text not null,
  overlay_settings jsonb not null,
  guides jsonb not null
);

-- Only the owner can read/write their sessions
alter table public.sessions enable row level security;

create policy "Users can manage own sessions"
  on public.sessions
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Storage: create bucket "images" in Dashboard → Storage if it doesn't exist, then run:
-- (Or create via API; here we assume bucket exists and is private.)

-- Policy: users can read/write objects under their own folder {user_id}/
-- Run in SQL Editor (storage policies are in public schema):

-- Allow upload/read/delete for own path
create policy "Users can manage own images"
  on storage.objects
  for all
  using (bucket_id = 'images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = (select auth.uid())::text);
