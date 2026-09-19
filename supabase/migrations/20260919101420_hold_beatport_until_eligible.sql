-- Beatport is an optional delivery target and TooLost requires an approved
-- Beatport genre. The current production runtime can inherit Beatport=true
-- from saved provider preferences for every release, which can cause final
-- submission to fail for otherwise valid genre/language metadata.
--
-- Preserve that Beatport was requested, but keep the active additional target
-- disabled until Nexo can validate eligibility before sending it upstream.

create or replace function public.hold_beatport_until_eligible()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if jsonb_typeof(coalesce(new.distribution_settings,'{}'::jsonb)->'additional') = 'object'
     and lower(coalesce(new.distribution_settings #>> '{additional,beatPort}','false')) = 'true'
  then
    new.distribution_settings :=
      jsonb_set(
        jsonb_set(
          coalesce(new.distribution_settings,'{}'::jsonb),
          '{beatPortRequested}',
          'true'::jsonb,
          true
        ),
        '{additional,beatPort}',
        'false'::jsonb,
        true
      );
  end if;
  return new;
end;
$$;

drop trigger if exists releases_hold_beatport_until_eligible on public.releases;

create trigger releases_hold_beatport_until_eligible
before insert or update of distribution_settings
on public.releases
for each row
execute function public.hold_beatport_until_eligible();

update public.releases
set distribution_settings =
  jsonb_set(
    jsonb_set(
      coalesce(distribution_settings,'{}'::jsonb),
      '{beatPortRequested}',
      case
        when lower(coalesce(distribution_settings #>> '{additional,beatPort}','false'))='true'
          then 'true'::jsonb
        else coalesce(distribution_settings->'beatPortRequested','false'::jsonb)
      end,
      true
    ),
    '{additional,beatPort}',
    'false'::jsonb,
    true
  ),
  updated_at=now()
where lower(coalesce(distribution_settings #>> '{additional,beatPort}','false'))='true';

comment on function public.hold_beatport_until_eligible() is
  'Temporary safety guard: preserve Beatport intent while preventing the current runtime from auto-enabling an ineligible Beatport delivery.';
