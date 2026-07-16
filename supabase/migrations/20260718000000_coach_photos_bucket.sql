-- Create Storage Bucket for Coach Photos
insert into storage.buckets (id, name, public)
values ('coach-photos', 'coach-photos', true)
on conflict (id) do nothing;

-- Storage Policies for coach-photos bucket
drop policy if exists "Allow public read access to coach-photos" on storage.objects;
create policy "Allow public read access to coach-photos"
on storage.objects for select to public
using (bucket_id = 'coach-photos');

drop policy if exists "Allow superadmins to manage coach-photos" on storage.objects;
create policy "Allow superadmins to manage coach-photos"
on storage.objects for all to authenticated
using (
  bucket_id = 'coach-photos' 
  and (select role from public.users where id = auth.uid()) = 'superadmin'
)
with check (
  bucket_id = 'coach-photos' 
  and (select role from public.users where id = auth.uid()) = 'superadmin'
);
