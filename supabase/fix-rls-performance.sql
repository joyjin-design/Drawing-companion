-- Run in SQL Editor to fix RLS performance (evaluate auth.uid() once per query, not per row).
-- Run this once; safe to re-run.

-- Sessions table: use (select auth.uid()) instead of auth.uid()
drop policy if exists "Users can manage own sessions" on public.sessions;

create policy "Users can manage own sessions"
  on public.sessions
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Storage: use (select auth.uid()) instead of auth.uid()
drop policy if exists "Users can manage own images" on storage.objects;

create policy "Users can manage own images"
  on storage.objects
  for all
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
