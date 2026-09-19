-- Keep known internal/provider delivery routing failures in admin operations.
-- These failures are not artist/label correction requests and must not trigger
-- changes_requested, artist notifications, or correction emails.

create or replace function public.block_internal_delivery_failure_artist_return()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_reason text := lower(coalesce(new.changes_requested_reason, ''));
begin
  if old.status = 'failed'::public.release_status
     and new.status = 'changes_requested'::public.release_status
     and (
       v_reason like '%delivery target has been disabled for this release%'
       or v_reason like '%please enter the store or additional store%'
       or v_reason like '%tiktokstarttime does not match the format%'
       or (
         v_reason like '%even%'
         and (
           v_reason like '%not connected%'
           or v_reason like '%connect an even account%'
         )
       )
     )
  then
    raise exception
      'Internal/provider delivery routing issue. Keep this release in Failed for admin retry; do not return it to the artist or label.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists releases_block_internal_delivery_artist_return on public.releases;

create trigger releases_block_internal_delivery_artist_return
before update of status
on public.releases
for each row
execute function public.block_internal_delivery_failure_artist_return();

comment on function public.block_internal_delivery_failure_artist_return() is
  'Prevents known Nexo/provider routing and formatting failures from being misclassified as artist corrections by older/current runtimes.';
