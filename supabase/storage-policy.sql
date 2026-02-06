-- Run this entire file in Supabase Dashboard → SQL Editor → New query

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
