-- NEXO DSP profile verification metadata for exact artist targeting.
alter table public.artist_dsp_links add column if not exists verification_status text not null default 'unverified' check(verification_status in ('unverified','verified','failed'));
alter table public.artist_dsp_links add column if not exists verified_at timestamptz;
alter table public.artist_dsp_links add column if not exists canonical_profile_id text;
create index if not exists artist_dsp_links_target_idx on public.artist_dsp_links(artist_profile_id,dsp_key,enabled) where enabled=true;
