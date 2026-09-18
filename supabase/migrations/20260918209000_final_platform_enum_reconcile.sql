-- Final platform enum reconciliation.
-- Kept separate so newly-added enum values are committed before later migrations use them.

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
    where t.typnamespace='public'::regnamespace and t.typname='notification_type'
      and e.enumlabel='broadcast'
  ) then
    alter type public.notification_type add value 'broadcast';
  end if;

  if not exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
    where t.typnamespace='public'::regnamespace and t.typname='notification_type'
      and e.enumlabel='agreement_update'
  ) then
    alter type public.notification_type add value 'agreement_update';
  end if;

  if not exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
    where t.typnamespace='public'::regnamespace and t.typname='notification_type'
      and e.enumlabel='verification_update'
  ) then
    alter type public.notification_type add value 'verification_update';
  end if;
end
$$;
