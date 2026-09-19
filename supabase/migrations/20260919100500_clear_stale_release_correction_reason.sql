-- Keep the current correction reason aligned with the current release state.
-- Historical correction reasons remain preserved in release_status_history.

update public.releases
set changes_requested_reason = null,
    updated_at = now()
where status <> 'changes_requested'
  and changes_requested_reason is not null;

create or replace function public.clear_stale_release_correction_reason()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from 'changes_requested'::public.release_status then
    new.changes_requested_reason := null;
  end if;
  return new;
end;
$$;

drop trigger if exists releases_clear_stale_correction_reason on public.releases;

create trigger releases_clear_stale_correction_reason
before insert or update of status
on public.releases
for each row
execute function public.clear_stale_release_correction_reason();

comment on function public.clear_stale_release_correction_reason() is
  'Clears the current artist-correction reason whenever a release leaves changes_requested. Historical reasons remain in release_status_history.';
