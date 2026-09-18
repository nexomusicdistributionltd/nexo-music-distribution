-- NEXO secure fanlink preview assets: only generated <=30s derivatives are public-playable.
alter table public.fanlinks add column if not exists preview_ready boolean not null default false;
alter table public.fanlinks add column if not exists preview_generated_at timestamptz;
alter table public.fanlinks add constraint fanlinks_preview_path_guard check (
 (preview_ready=false) or (preview_storage_bucket='fanlink-previews' and preview_storage_path is not null and preview_seconds<=30)
) not valid;
alter table public.fanlinks validate constraint fanlinks_preview_path_guard;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('fanlink-previews','fanlink-previews',false,15728640,array['audio/mpeg','audio/mp4','audio/aac','audio/ogg'])
on conflict(id) do update set public=false;
