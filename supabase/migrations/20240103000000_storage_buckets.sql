-- Storage bucket for activity screenshots (user-initiated, opt-in only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'activity-screenshots',
  'activity-screenshots',
  false,
  5242880, -- 5 MB per file
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Workers can upload their own screenshots only
create policy "workers_upload_own_screenshots"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'activity-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Workers can read their own screenshots
create policy "workers_read_own_screenshots"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'activity-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all screenshots
create policy "admins_read_all_screenshots"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'activity-screenshots'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Workers can delete their own screenshots
create policy "workers_delete_own_screenshots"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'activity-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
