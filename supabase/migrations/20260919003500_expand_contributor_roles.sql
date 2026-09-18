-- Expand contributor credits for Apple/DDEX-complete metadata.
-- Existing values are preserved; these additions are non-destructive.

alter type public.contributor_role add value if not exists 'lead_vocals';
alter type public.contributor_role add value if not exists 'vocals';
alter type public.contributor_role add value if not exists 'background_vocals';
alter type public.contributor_role add value if not exists 'choir';
alter type public.contributor_role add value if not exists 'choir_member';
alter type public.contributor_role add value if not exists 'chorus';
alter type public.contributor_role add value if not exists 'guitar';
alter type public.contributor_role add value if not exists 'bass_guitar';
alter type public.contributor_role add value if not exists 'drums';
alter type public.contributor_role add value if not exists 'keyboards';
alter type public.contributor_role add value if not exists 'percussion';
alter type public.contributor_role add value if not exists 'instrumentalist';
alter type public.contributor_role add value if not exists 'arranger';
alter type public.contributor_role add value if not exists 'recording_engineer';
alter type public.contributor_role add value if not exists 'mixing_engineer';
alter type public.contributor_role add value if not exists 'mastering_engineer';
alter type public.contributor_role add value if not exists 'graphic_designer';
alter type public.contributor_role add value if not exists 'a_and_r';
alter type public.contributor_role add value if not exists 'artist_manager';
alter type public.contributor_role add value if not exists 'sampled_artist';
alter type public.contributor_role add value if not exists 'licensed_verse';
alter type public.contributor_role add value if not exists 'licensed_beat';
