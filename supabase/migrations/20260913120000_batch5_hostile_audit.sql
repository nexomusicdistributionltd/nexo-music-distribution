-- NEXO Batch 5 hostile-audit closure.

-- Client roles must never directly submit money fields; only trusted jobs/RPCs may write.
drop policy if exists "payouts_staff_insert" on public.payouts;
drop policy if exists "payout_adjustments_staff_insert" on public.payout_adjustments;

-- Settings are an explicit operational allowlist, enforced in DB as well as app.
create or replace function public.validate_admin_setting()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.key not in (
    'qc.default_priority',
    'qc.auto_claim',
    'support.sla_hours',
    'contact.auto_assign',
    'operations.maintenance_notice',
    'reports.retention_days'
  ) then
    raise exception 'Setting key is not allowlisted' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists admin_settings_validate on public.admin_settings;
create trigger admin_settings_validate
  before insert or update on public.admin_settings
  for each row execute function public.validate_admin_setting();

-- Every account action creates a reason-free operational timeline event. The reason
-- remains in account_actions and is exposed only per that table's visibility policy.
create or replace function public.account_action_timeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_events (
    actor_user_id, subject_user_id, entity_type, entity_id, event_type,
    summary, visibility, metadata
  ) values (
    new.actor_user_id, new.target_user_id, 'profile', new.target_user_id,
    'account_' || new.action,
    'Account status action: ' || new.action,
    case when new.artist_visible then 'subject' else 'staff' end,
    jsonb_build_object('action', new.action)
  );
  return new;
end;
$$;

drop trigger if exists account_actions_timeline on public.account_actions;
create trigger account_actions_timeline
  after insert on public.account_actions
  for each row execute function public.account_action_timeline();

-- Attachment DB paths must stay under the uploader's private prefix.
create or replace function public.protect_support_attachment_path()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.uploaded_by is null
     or new.storage_bucket <> 'support-attachments'
     or new.storage_path not like new.uploaded_by::text || '/%'
     or new.storage_path like '%..%'
     or new.storage_path like '%\\%' then
    raise exception 'Invalid support attachment path' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists support_attachments_protect_path on public.support_attachments;
create trigger support_attachments_protect_path
  before insert or update on public.support_attachments
  for each row execute function public.protect_support_attachment_path();

-- Audit rows are immutable to authenticated clients (existing schema has no update/delete policy).
-- Internal email status sent remains service-job only; there are no client write policies.

-- Ticket requesters can upload only under their own private prefix.
drop policy if exists "support_attachments_owner_insert" on storage.objects;
create policy "support_attachments_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
