-- NEXO — DDEX ERN 4.3.2 production ledger + private XML bucket

alter table public.ddex_messages
  add column if not exists filename text,
  add column if not exists xml_sha256 text,
  add column if not exists avs_version_id int not null default 9,
  add column if not exists release_profile text not null default 'Audio';

comment on table public.ddex_messages is
  'Staff-only ERN 4.3.2 NewReleaseMessage ledger. xml_storage_path is private. Never mark valid without XSD pass. Never mark delivered without a real transport.';
comment on column public.ddex_messages.xml_storage_path is
  'Private storage path in bucket ddex-ern. Not a public URL.';
comment on column public.ddex_messages.delivery_status is
  'pending until a real transport delivers. Application code must not set delivered without transport success.';
comment on column public.ddex_messages.validation_status is
  'pending | valid | invalid. valid only after official ERN 4.3.2 XSD pass.';

alter table public.ddex_messages
  drop constraint if exists ddex_messages_validation_status_chk;
alter table public.ddex_messages
  add constraint ddex_messages_validation_status_chk
  check (validation_status in ('pending', 'valid', 'invalid'));

alter table public.ddex_messages
  drop constraint if exists ddex_messages_delivery_status_chk;
alter table public.ddex_messages
  add constraint ddex_messages_delivery_status_chk
  check (delivery_status in ('pending', 'failed', 'delivered'));

alter table public.ddex_messages
  drop constraint if exists ddex_messages_ern_version_chk;
alter table public.ddex_messages
  add constraint ddex_messages_ern_version_chk
  check (ern_version = '4.3.2');

alter table public.ddex_messages
  drop constraint if exists ddex_messages_avs_chk;
alter table public.ddex_messages
  add constraint ddex_messages_avs_chk
  check (avs_version_id = 9);

-- Private ERN XML. Staff-only. Never public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ddex-ern',
  'ddex-ern',
  false,
  10485760,
  array['application/xml', 'text/xml', 'application/octet-stream']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "ddex_ern_staff_select" on storage.objects;
create policy "ddex_ern_staff_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'ddex-ern' and public.is_staff(auth.uid()));

drop policy if exists "ddex_ern_staff_insert" on storage.objects;
create policy "ddex_ern_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ddex-ern' and public.is_staff(auth.uid()));

drop policy if exists "ddex_ern_staff_update" on storage.objects;
create policy "ddex_ern_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'ddex-ern' and public.is_staff(auth.uid()))
  with check (bucket_id = 'ddex-ern' and public.is_staff(auth.uid()));

-- No public read. No client download policy for non-staff.
