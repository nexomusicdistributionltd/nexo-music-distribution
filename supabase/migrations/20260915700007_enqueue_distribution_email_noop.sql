-- Leftover Batch 6 callers still `perform public.enqueue_distribution_email(...)`
-- after `transition_release_status`. The 20260915700006 wrapper remapped poorly
-- (non-`release_status_%` keys defaulted from/to `approved`, history id was
-- `gen_random_uuid()`) and inserted a second email_outbound_events row — often
-- RELEASE_APPROVED — with a different idempotency key.
--
-- Canonical path remains:
--   transition_release_status → enqueue_release_catalog_email → email_outbound_events
-- (stable key RELEASE_STATUS:<release_id>:<new_status>:<history_id>).
--
-- This replace is a no-op so leftover perform calls cannot enqueue. Notifications
-- and release status semantics are unchanged. Failure here must not raise.

create or replace function public.enqueue_distribution_email(
  p_release_id uuid,
  p_template_key text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Leftover Batch 6 callers; catalog mail is enqueued in transition_release_status.
  return null;
exception
  when others then
    return null;
end;
$$;

comment on function public.enqueue_distribution_email(uuid, text, jsonb) is
  'No-op. Release workflow mail is enqueued only by transition_release_status → enqueue_release_catalog_email into email_outbound_events.';

revoke all on function public.enqueue_distribution_email(uuid, text, jsonb) from public;
