-- Replace broad SELECT with a non-listing public read policy
drop policy if exists "Avatar images are publicly accessible" on storage.objects;

create policy "Avatar images are publicly readable (no listing)"
on storage.objects for select
using (
  bucket_id = 'avatars'
  and (storage.foldername(name)) is not null
  and array_length(storage.foldername(name), 1) >= 1
);
