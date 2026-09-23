-- Storage bucket for the organization logo used by /admin/settings
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

create policy "authenticated_branding_access" on storage.objects
for all to authenticated using (bucket_id = 'branding') with check (bucket_id = 'branding');
