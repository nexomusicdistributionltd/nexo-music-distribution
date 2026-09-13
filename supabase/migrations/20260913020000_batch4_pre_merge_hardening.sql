-- NEXO Batch 4 — hostile pre-merge hardening
-- Additive. Tightens privileged fields, storage mutability, notifications, history.

-- ---------------------------------------------------------------------------
-- 1. Strengthen protect_release_privileged_fields
-- ---------------------------------------------------------------------------
create or replace function public.protect_release_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  staff boolean;
  internal boolean;
begin
  internal := current_setting('nexo.internal_release_update', true) = '1';
  staff := auth.uid() is null
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'support');

  if tg_op = 'INSERT' then
    if not staff and not internal then
      new.status := 'draft';
      new.provider_name := null;
      new.provider_release_id := null;
      new.provider_status := null;
      new.provider_metadata := '{}'::jsonb;
      new.provider_connected := false;
      new.locked_at := null;
      new.submitted_at := null;
      new.rejection_reason := null;
      new.changes_requested_reason := null;
      -- Owner must be the inserting user
      if auth.uid() is not null then
        new.owner_user_id := auth.uid();
      end if;
    end if;
    return new;
  end if;

  if staff or internal then
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'Status changes must go through server-enforced transitions'
      using errcode = '42501';
  end if;

  if new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'owner_user_id is not user-editable'
      using errcode = '42501';
  end if;

  if new.provider_name is distinct from old.provider_name
     or new.provider_release_id is distinct from old.provider_release_id
     or new.provider_status is distinct from old.provider_status
     or new.provider_metadata is distinct from old.provider_metadata
     or new.provider_connected is distinct from old.provider_connected
     or new.locked_at is distinct from old.locked_at
     or new.submitted_at is distinct from old.submitted_at
     or new.rejection_reason is distinct from old.rejection_reason
     or new.changes_requested_reason is distinct from old.changes_requested_reason then
    raise exception 'Provider, lock, and QC reason fields are not user-editable'
      using errcode = '42501';
  end if;

  if old.status not in ('draft', 'changes_requested') then
    raise exception 'Release is locked and cannot be edited in status %', old.status
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Storage: mutate only while release is editable (path = userId/releaseId/...)
-- ---------------------------------------------------------------------------
create or replace function public.storage_object_release_mutable(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  rid uuid;
begin
  if public.is_staff(auth.uid()) then
    return true;
  end if;
  parts := storage.foldername(object_name);
  if parts is null or array_length(parts, 1) < 2 then
    return false;
  end if;
  if parts[1] is distinct from auth.uid()::text then
    return false;
  end if;
  begin
    rid := parts[2]::uuid;
  exception when others then
    return false;
  end;
  return public.release_is_editable(rid);
end;
$$;

revoke all on function public.storage_object_release_mutable(text) from public;
grant execute on function public.storage_object_release_mutable(text) to authenticated;

-- release-audio mutability
drop policy if exists "release_audio_insert_own" on storage.objects;
create policy "release_audio_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'release-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.storage_object_release_mutable(name)
  );

drop policy if exists "release_audio_update_own" on storage.objects;
create policy "release_audio_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'release-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.storage_object_release_mutable(name)
  )
  with check (
    bucket_id = 'release-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.storage_object_release_mutable(name)
  );

drop policy if exists "release_audio_delete_own" on storage.objects;
create policy "release_audio_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'release-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.storage_object_release_mutable(name)
  );

-- release-artwork mutability
drop policy if exists "release_artwork_insert_own" on storage.objects;
create policy "release_artwork_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'release-artwork'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.storage_object_release_mutable(name)
  );

drop policy if exists "release_artwork_update_own" on storage.objects;
create policy "release_artwork_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'release-artwork'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.storage_object_release_mutable(name)
  )
  with check (
    bucket_id = 'release-artwork'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.storage_object_release_mutable(name)
  );

drop policy if exists "release_artwork_delete_own" on storage.objects;
create policy "release_artwork_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'release-artwork'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.storage_object_release_mutable(name)
  );

-- Ensure buckets stay private
update storage.buckets set public = false where id in ('release-audio', 'release-artwork');

-- ---------------------------------------------------------------------------
-- 3. Notifications: no client forge; update only read_at
-- ---------------------------------------------------------------------------
drop policy if exists "notifications_insert_staff_or_self_system" on public.notifications;
drop policy if exists "notifications_insert_staff" on public.notifications;
create policy "notifications_insert_staff" on public.notifications
  for insert to authenticated
  with check (public.is_staff(auth.uid()));

-- SECURITY DEFINER helpers still insert (bypass RLS). Client self-insert removed.

create or replace function public.protect_notification_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if public.is_staff(auth.uid())
       or current_setting('nexo.internal_release_update', true) = '1' then
      return new;
    end if;
    -- Non-staff may only flip read_at on their own row
    if new.user_id is distinct from old.user_id
       or new.type is distinct from old.type
       or new.title is distinct from old.title
       or new.body is distinct from old.body
       or new.entity_type is distinct from old.entity_type
       or new.entity_id is distinct from old.entity_id
       or new.created_at is distinct from old.created_at then
      raise exception 'Only read_at may be updated on notifications'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_protect_fields on public.notifications;
create trigger notifications_protect_fields
  before update on public.notifications
  for each row execute function public.protect_notification_fields();

-- No client deletes of notifications
drop policy if exists "notifications_no_delete" on public.notifications;
create policy "notifications_no_delete" on public.notifications
  for delete to authenticated
  using (false);

-- ---------------------------------------------------------------------------
-- 4. Status history / submissions: explicit no update/delete
-- ---------------------------------------------------------------------------
drop policy if exists "release_status_history_no_update" on public.release_status_history;
create policy "release_status_history_no_update" on public.release_status_history
  for update to authenticated
  using (false);

drop policy if exists "release_status_history_no_delete" on public.release_status_history;
create policy "release_status_history_no_delete" on public.release_status_history
  for delete to authenticated
  using (false);

drop policy if exists "release_submissions_no_update" on public.release_submissions;
create policy "release_submissions_no_update" on public.release_submissions
  for update to authenticated
  using (false);

drop policy if exists "release_submissions_no_delete" on public.release_submissions;
create policy "release_submissions_no_delete" on public.release_submissions
  for delete to authenticated
  using (false);

-- ---------------------------------------------------------------------------
-- 5. Notify owner on status transitions (replaces client-side forgeable inserts)
-- ---------------------------------------------------------------------------
create or replace function public.transition_release_status(
  p_release_id uuid,
  p_new_status public.release_status,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.releases
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.releases;
  actor uuid := auth.uid();
  staff boolean;
  owner_ok boolean;
  allowed boolean := false;
  ntype public.notification_type;
  ntitle text;
  nbody text;
begin
  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  staff := actor is not null and (
    public.has_role(actor, 'admin')
    or public.has_role(actor, 'super_admin')
    or public.has_role(actor, 'support')
  );
  owner_ok := actor is not null and r.owner_user_id = actor;

  if owner_ok and not staff then
    if r.status in ('draft', 'changes_requested') and p_new_status = 'submitted' then
      allowed := true;
    elsif r.status in ('approved', 'scheduled', 'delivered', 'live')
          and p_new_status = 'takedown_requested' then
      allowed := true;
    end if;
  end if;

  if staff then
    if r.status = 'submitted' and p_new_status in ('in_qc', 'changes_requested', 'rejected', 'approved') then
      allowed := true;
    elsif r.status = 'in_qc' and p_new_status in ('changes_requested', 'rejected', 'approved') then
      allowed := true;
    elsif r.status = 'approved' and p_new_status in ('scheduled', 'rejected', 'changes_requested') then
      allowed := true;
    elsif r.status = 'scheduled' and p_new_status in ('delivering', 'changes_requested') then
      allowed := true;
    elsif r.status = 'delivering' and p_new_status in ('delivered', 'live', 'rejected') then
      allowed := true;
    elsif r.status = 'delivered' and p_new_status in ('live') then
      allowed := true;
    elsif r.status = 'takedown_requested' and p_new_status in ('taken_down', 'live', 'delivered') then
      allowed := true;
    elsif r.status = 'rejected' and p_new_status in ('draft', 'changes_requested') then
      allowed := true;
    end if;
  end if;

  if not allowed then
    raise exception 'Transition from % to % is not permitted for this actor', r.status, p_new_status
      using errcode = '42501';
  end if;

  if p_new_status in ('delivering', 'delivered', 'live') and not r.provider_connected then
    raise exception 'Provider not connected — cannot move to %', p_new_status
      using errcode = 'P0001';
  end if;

  perform set_config('nexo.internal_release_update', '1', true);

  insert into public.release_status_history (release_id, previous_status, new_status, actor_user_id, reason, metadata)
  values (r.id, r.status, p_new_status, actor, p_reason, coalesce(p_metadata, '{}'::jsonb));

  update public.releases
  set
    status = p_new_status,
    submitted_at = case when p_new_status = 'submitted' then now() else submitted_at end,
    locked_at = case
      when p_new_status in ('submitted', 'in_qc', 'approved', 'scheduled', 'delivering', 'delivered', 'live', 'takedown_requested', 'taken_down')
        then coalesce(locked_at, now())
      when p_new_status in ('draft', 'changes_requested')
        then null
      else locked_at
    end,
    rejection_reason = case when p_new_status = 'rejected' then p_reason else rejection_reason end,
    changes_requested_reason = case when p_new_status = 'changes_requested' then p_reason else changes_requested_reason end,
    updated_at = now()
  where id = r.id
  returning * into r;

  -- Owner inbox (skip duplicate when submit_release_to_qc also notifies on submitted)
  if coalesce(p_metadata->>'source', '') is distinct from 'submit_release_to_qc' then
    ntype := case p_new_status
      when 'changes_requested' then 'qc_changes_requested'::public.notification_type
      when 'approved' then 'qc_approved'::public.notification_type
      when 'rejected' then 'qc_rejected'::public.notification_type
      when 'live' then 'release_live'::public.notification_type
      when 'takedown_requested' then 'takedown_update'::public.notification_type
      when 'taken_down' then 'takedown_update'::public.notification_type
      else 'release_status_changed'::public.notification_type
    end;
    ntitle := case p_new_status
      when 'takedown_requested' then 'Takedown requested'
      when 'taken_down' then 'Takedown complete'
      when 'approved' then 'Release approved'
      when 'rejected' then 'Release rejected'
      when 'changes_requested' then 'Changes requested'
      when 'live' then 'Release live'
      else 'Release status updated'
    end;
    nbody := 'Your release "' || coalesce(r.title, 'Untitled') || '" is now ' || p_new_status::text || '.';
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
    values (r.owner_user_id, ntype, ntitle, nbody, 'release', r.id);
  end if;

  perform set_config('nexo.internal_release_update', '0', true);

  return r;
end;
$$;

revoke all on function public.transition_release_status(uuid, public.release_status, text, jsonb) from public;
grant execute on function public.transition_release_status(uuid, public.release_status, text, jsonb) to authenticated;

comment on function public.storage_object_release_mutable(text) is
  'Batch 4 hardening: storage writes only while parent release is draft/changes_requested for the path owner.';
