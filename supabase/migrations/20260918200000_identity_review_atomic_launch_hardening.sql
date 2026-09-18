-- Reconcile production identity review hardening into source control.
-- Must run after the identity verification schema/migrations.

alter default privileges in schema public revoke execute on functions from public;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.identity_verifications'::regclass
      and conname='identity_nin_country_check'
  ) then
    alter table public.identity_verifications
      add constraint identity_nin_country_check
      check (document_type <> 'nin'::public.identity_document_type or country_code='NG');
  end if;
end $$;

create index if not exists identity_events_actor_user_idx
  on public.identity_verification_events(actor_user_id)
  where actor_user_id is not null;
create index if not exists identity_events_submission_idx
  on public.identity_verification_events(submission_id)
  where submission_id is not null;
create index if not exists identity_submissions_reviewed_by_idx
  on public.identity_verification_submissions(reviewed_by)
  where reviewed_by is not null;
create index if not exists identity_submissions_verification_idx
  on public.identity_verification_submissions(verification_id);
create index if not exists identity_verifications_latest_submission_idx
  on public.identity_verifications(latest_submission_id)
  where latest_submission_id is not null;
create index if not exists identity_verifications_reviewed_by_idx
  on public.identity_verifications(reviewed_by)
  where reviewed_by is not null;
create index if not exists profiles_identity_verification_idx
  on public.profiles(identity_verification_id)
  where identity_verification_id is not null;

create or replace function public.review_identity_verification_admin(
  p_verification_id uuid,
  p_submission_id uuid,
  p_status public.identity_verification_status,
  p_reason text default null,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_user uuid;
  v_legal_name text;
  v_latest uuid;
  v_reason text := nullif(btrim(coalesce(p_reason,'')), '');
  v_admin_note text := nullif(btrim(coalesce(p_admin_note,'')), '');
  v_now timestamptz := now();
begin
  if v_actor is null or not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_actor
      and ur.role in ('admin','super_admin')
  ) then
    raise exception 'Administrator permission required' using errcode='42501';
  end if;

  if p_status not in (
    'under_review'::public.identity_verification_status,
    'verified'::public.identity_verification_status,
    'declined'::public.identity_verification_status,
    'additional_info_required'::public.identity_verification_status
  ) then
    raise exception 'Invalid identity review status' using errcode='22023';
  end if;

  if p_status in (
    'declined'::public.identity_verification_status,
    'additional_info_required'::public.identity_verification_status
  ) and v_reason is null then
    raise exception 'A reason is required for this review decision' using errcode='22023';
  end if;

  select v.user_id, v.legal_name, v.latest_submission_id
    into v_user, v_legal_name, v_latest
  from public.identity_verifications v
  where v.id = p_verification_id
  for update;

  if not found then
    raise exception 'Verification record was not found' using errcode='P0002';
  end if;

  if v_latest is distinct from p_submission_id then
    raise exception 'Review the latest verification submission' using errcode='22023';
  end if;

  perform 1
  from public.identity_verification_submissions s
  where s.id = p_submission_id
    and s.verification_id = p_verification_id
    and s.user_id = v_user
  for update;

  if not found then
    raise exception 'Verification submission was not found' using errcode='P0002';
  end if;

  update public.identity_verifications
  set status = p_status,
      reason = v_reason,
      admin_note = v_admin_note,
      reviewed_by = v_actor,
      reviewed_at = v_now,
      verified_at = case when p_status='verified'::public.identity_verification_status then v_now else null end,
      updated_at = v_now
  where id = p_verification_id;

  update public.identity_verification_submissions
  set status = p_status,
      reason = v_reason,
      admin_note = v_admin_note,
      reviewed_by = v_actor,
      reviewed_at = v_now,
      verified_at = case when p_status='verified'::public.identity_verification_status then v_now else null end
  where id = p_submission_id
    and verification_id = p_verification_id;

  if p_status='verified'::public.identity_verification_status then
    update public.profiles
    set full_name = v_legal_name,
        identity_verified_at = v_now,
        identity_verification_id = p_verification_id,
        account_status = case
          when account_status='pending_verification'::public.account_status
            then 'active'::public.account_status
          else account_status
        end,
        updated_at = v_now
    where id = v_user;
  else
    update public.profiles p
    set identity_verified_at = null,
        identity_verification_id = null,
        account_status = case
          when p.account_status='active'::public.account_status
           and exists (
             select 1 from public.user_roles ur
             where ur.user_id=p.id and ur.role in ('artist','label')
           )
           and not exists (
             select 1 from public.user_roles ur
             where ur.user_id=p.id and ur.role in ('support','admin','super_admin')
           )
          then 'pending_verification'::public.account_status
          else p.account_status
        end,
        updated_at = v_now
    where p.id = v_user;
  end if;

  insert into public.identity_verification_events (
    verification_id, submission_id, user_id, actor_user_id, event_type, metadata
  ) values (
    p_verification_id,
    p_submission_id,
    v_user,
    v_actor,
    'verification_' || p_status::text,
    case when v_reason is null then '{}'::jsonb else jsonb_build_object('reason',v_reason) end
  );

  insert into public.notifications (
    user_id, type, title, body, entity_type, entity_id
  ) values (
    v_user,
    'verification_update',
    'Identity verification updated',
    case
      when p_status='verified'::public.identity_verification_status then 'Your identity has been verified.'
      when p_status='declined'::public.identity_verification_status then 'Your identity verification was declined. Review the reason and submit new live captures.'
      when p_status='additional_info_required'::public.identity_verification_status then 'Additional information is required for your identity verification.'
      else 'Your identity verification is under review.'
    end,
    'identity_verification',
    p_verification_id
  );
end;
$$;

revoke all on function public.review_identity_verification_admin(
  uuid, uuid, public.identity_verification_status, text, text
) from public, anon;
grant execute on function public.review_identity_verification_admin(
  uuid, uuid, public.identity_verification_status, text, text
) to authenticated, service_role;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and p.proname = any(array[
        'admin_set_account_status',
        'admin_set_artist_website',
        'admin_set_release_website',
        'admin_upsert_website_setting',
        'admin_upsert_website_video',
        'claim_qc_item',
        'complete_payout_paid',
        'create_catalog_migration',
        'create_label_roster_artist',
        'create_own_catalog_migration',
        'create_payout_request',
        'import_own_catalog_migration_items',
        'list_owner_ddex_status',
        'move_in_own_catalog_migration',
        'offer_old_distributor_takedown',
        'payout_eligibility',
        'perform_qc_decision',
        'post_ledger_adjustment',
        'publish_royalty_statement',
        'queue_approved_release',
        'record_provider_sync_run',
        'reinstate_distribution_release',
        'release_qc_item',
        'request_distribution_takedown',
        'set_own_catalog_migration_step',
        'set_payout_compliance_hold',
        'set_qc_item_priority',
        'submit_release_to_qc',
        'super_admin_set_roles',
        'transition_payout_status',
        'transition_release_status',
        'upsert_artist_dsp_mapping',
        'upsert_royalty_import_batch',
        'upsert_royalty_import_row',
        'write_audit_log'
      ]::text[])
  loop
    execute format('revoke execute on function %s from public, anon', r.fn);
    execute format('grant execute on function %s to authenticated, service_role', r.fn);
  end loop;
end $$;
