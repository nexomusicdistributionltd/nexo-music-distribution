-- Four-group Nexo royalty commission policy.
-- Existing legacy rates are copied into all four groups so this migration is
-- economically neutral until an authorized admin changes a percentage.

alter table public.royalty_commission_policy
  add column if not exists artist_paid_bps integer,
  add column if not exists artist_free_bps integer,
  add column if not exists label_paid_bps integer,
  add column if not exists label_free_bps integer;

update public.royalty_commission_policy
set artist_paid_bps = coalesce(artist_paid_bps, paid_plan_bps),
    artist_free_bps = coalesce(artist_free_bps, free_plan_bps),
    label_paid_bps = coalesce(label_paid_bps, paid_plan_bps),
    label_free_bps = coalesce(label_free_bps, free_plan_bps)
where id = 'default';

alter table public.royalty_commission_policy
  alter column artist_paid_bps set not null,
  alter column artist_free_bps set not null,
  alter column label_paid_bps set not null,
  alter column label_free_bps set not null;

alter table public.royalty_commission_policy
  drop constraint if exists royalty_commission_policy_artist_paid_bps_check,
  drop constraint if exists royalty_commission_policy_artist_free_bps_check,
  drop constraint if exists royalty_commission_policy_label_paid_bps_check,
  drop constraint if exists royalty_commission_policy_label_free_bps_check;

alter table public.royalty_commission_policy
  add constraint royalty_commission_policy_artist_paid_bps_check
    check (artist_paid_bps between 0 and 9999),
  add constraint royalty_commission_policy_artist_free_bps_check
    check (artist_free_bps between 0 and 9999),
  add constraint royalty_commission_policy_label_paid_bps_check
    check (label_paid_bps between 0 and 9999),
  add constraint royalty_commission_policy_label_free_bps_check
    check (label_free_bps between 0 and 9999);

comment on column public.royalty_commission_policy.paid_plan_bps is
  'Legacy compatibility value. New royalty posting uses account-type-specific paid/free columns.';
comment on column public.royalty_commission_policy.free_plan_bps is
  'Legacy compatibility value. New royalty posting uses account-type-specific paid/free columns.';
comment on table public.royalty_commission_policy is
  'Current Nexo royalty commission policy. Rates are basis points and are applied prospectively when new royalty rows are posted; posted ledger rows keep their original commission snapshot.';

create table if not exists public.royalty_commission_policy_history (
  id uuid primary key default gen_random_uuid(),
  artist_paid_bps integer not null check (artist_paid_bps between 0 and 9999),
  artist_free_bps integer not null check (artist_free_bps between 0 and 9999),
  label_paid_bps integer not null check (label_paid_bps between 0 and 9999),
  label_free_bps integer not null check (label_free_bps between 0 and 9999),
  reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.royalty_commission_policy_history enable row level security;
revoke all on public.royalty_commission_policy_history from anon, authenticated;
grant all on public.royalty_commission_policy_history to service_role;

insert into public.royalty_commission_policy_history (
  artist_paid_bps,
  artist_free_bps,
  label_paid_bps,
  label_free_bps,
  reason,
  changed_by
)
select
  p.artist_paid_bps,
  p.artist_free_bps,
  p.label_paid_bps,
  p.label_free_bps,
  'Initial four-group policy migrated from legacy paid/free commission settings',
  null
from public.royalty_commission_policy p
where p.id = 'default'
  and not exists (select 1 from public.royalty_commission_policy_history);

create or replace function public.update_royalty_commission_policy(
  p_artist_paid_bps integer,
  p_artist_free_bps integer,
  p_label_paid_bps integer,
  p_label_free_bps integer,
  p_reason text default null
)
returns public.royalty_commission_policy
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  old_policy public.royalty_commission_policy;
  new_policy public.royalty_commission_policy;
  clean_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:royalties') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_artist_paid_bps not between 0 and 9999
     or p_artist_free_bps not between 0 and 9999
     or p_label_paid_bps not between 0 and 9999
     or p_label_free_bps not between 0 and 9999 then
    raise exception 'Commission must be between 0.00%% and 99.99%%'
      using errcode = '22023';
  end if;

  select * into old_policy
  from public.royalty_commission_policy
  where id = 'default'
  for update;

  if not found then
    raise exception 'Royalty commission policy missing' using errcode = 'P0001';
  end if;

  update public.royalty_commission_policy
  set artist_paid_bps = p_artist_paid_bps,
      artist_free_bps = p_artist_free_bps,
      label_paid_bps = p_label_paid_bps,
      label_free_bps = p_label_free_bps,
      -- Preserve a reasonable legacy fallback for older read-only code.
      paid_plan_bps = p_artist_paid_bps,
      free_plan_bps = p_artist_free_bps,
      updated_by = actor,
      updated_at = now()
  where id = 'default'
  returning * into new_policy;

  insert into public.royalty_commission_policy_history (
    artist_paid_bps,
    artist_free_bps,
    label_paid_bps,
    label_free_bps,
    reason,
    changed_by
  ) values (
    new_policy.artist_paid_bps,
    new_policy.artist_free_bps,
    new_policy.label_paid_bps,
    new_policy.label_free_bps,
    clean_reason,
    actor
  );

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    actor,
    'royalty_commission_policy_update',
    'royalty_commission_policy',
    null,
    jsonb_build_object(
      'old', jsonb_build_object(
        'artist_paid_bps', old_policy.artist_paid_bps,
        'artist_free_bps', old_policy.artist_free_bps,
        'label_paid_bps', old_policy.label_paid_bps,
        'label_free_bps', old_policy.label_free_bps
      ),
      'new', jsonb_build_object(
        'artist_paid_bps', new_policy.artist_paid_bps,
        'artist_free_bps', new_policy.artist_free_bps,
        'label_paid_bps', new_policy.label_paid_bps,
        'label_free_bps', new_policy.label_free_bps
      ),
      'reason', clean_reason
    )
  );

  return new_policy;
end;
$$;

revoke all on function public.update_royalty_commission_policy(integer,integer,integer,integer,text) from public;
grant execute on function public.update_royalty_commission_policy(integer,integer,integer,integer,text) to authenticated;

create or replace function public.post_royalty_import_batch(p_batch_id uuid)
returns public.royalty_import_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  b public.royalty_import_batches;
  r public.royalty_import_rows;
  match_count integer;
  matched_track_id uuid;
  matched_release_id uuid;
  matched_owner_id uuid;
  owner_account_type text;
  policy_group text;
  release_upc text;
  paid_access boolean;
  policy public.royalty_commission_policy;
  commission_bps_value integer;
  gross_value bigint;
  commission_value bigint;
  net_value bigint;
  acct_id uuid;
  entry_id uuid;
  normalized_isrc text;
  normalized_upc text;
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:royalties') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into b from public.royalty_import_batches
  where id = p_batch_id
  for update;
  if not found then
    raise exception 'Batch not found' using errcode = 'P0002';
  end if;

  select * into policy from public.royalty_commission_policy where id = 'default';
  if not found then
    raise exception 'Royalty commission policy missing' using errcode = 'P0001';
  end if;

  update public.royalty_import_batches
  set status = 'processing', error_summary = null
  where id = p_batch_id;

  for r in
    select * from public.royalty_import_rows
    where batch_id = p_batch_id and match_status <> 'posted'
    order by created_at, id
    for update
  loop
    matched_track_id := null;
    matched_release_id := null;
    matched_owner_id := null;
    owner_account_type := null;
    policy_group := null;
    release_upc := null;
    match_count := 0;
    entry_id := null;

    if r.amount_minor is null or r.amount_minor = 0 then
      update public.royalty_import_rows
      set match_status = 'conflict', conflict_reason = 'amount_missing_or_zero'
      where id = r.id;
      continue;
    end if;
    if r.currency is null or r.currency !~ '^[A-Z]{3}$' then
      update public.royalty_import_rows
      set match_status = 'conflict', conflict_reason = 'currency_missing_or_invalid'
      where id = r.id;
      continue;
    end if;

    normalized_isrc := upper(regexp_replace(coalesce(r.isrc, ''), '[^A-Z0-9]', '', 'g'));
    normalized_upc := regexp_replace(coalesce(r.upc, ''), '[^0-9]', '', 'g');

    if normalized_isrc <> '' then
      select count(*), min(rt.id), min(rel.id), min(rel.owner_user_id), min(rel.upc)
      into match_count, matched_track_id, matched_release_id, matched_owner_id, release_upc
      from public.release_tracks rt
      join public.releases rel on rel.id = rt.release_id
      where upper(regexp_replace(coalesce(rt.isrc, ''), '[^A-Z0-9]', '', 'g')) = normalized_isrc;

      if match_count > 1 then
        update public.royalty_import_rows
        set match_status = 'conflict', conflict_reason = 'duplicate_isrc_match'
        where id = r.id;
        continue;
      end if;
    end if;

    if matched_release_id is not null and normalized_upc <> '' then
      if regexp_replace(coalesce(release_upc, ''), '[^0-9]', '', 'g') <> normalized_upc then
        update public.royalty_import_rows
        set match_status = 'conflict', conflict_reason = 'isrc_upc_mismatch'
        where id = r.id;
        continue;
      end if;
    end if;

    if matched_release_id is null and normalized_upc <> '' then
      select count(*), min(rel.id), min(rel.owner_user_id)
      into match_count, matched_release_id, matched_owner_id
      from public.releases rel
      where regexp_replace(coalesce(rel.upc, ''), '[^0-9]', '', 'g') = normalized_upc;

      if match_count > 1 then
        update public.royalty_import_rows
        set match_status = 'conflict', conflict_reason = 'duplicate_upc_match'
        where id = r.id;
        continue;
      end if;
    end if;

    if matched_release_id is null or matched_owner_id is null then
      update public.royalty_import_rows
      set match_status = 'unmatched', conflict_reason = 'no_catalog_match'
      where id = r.id;
      continue;
    end if;

    select p.account_type into owner_account_type
    from public.profiles p
    where p.id = matched_owner_id;

    if owner_account_type not in ('artist','label') then
      update public.royalty_import_rows
      set match_status = 'conflict',
          conflict_reason = 'owner_account_type_invalid',
          release_id = matched_release_id,
          track_id = matched_track_id,
          owner_user_id = matched_owner_id
      where id = r.id;
      continue;
    end if;

    if owner_account_type = 'artist' then
      paid_access :=
        exists (
          select 1 from public.billing_entitlement_overrides o
          where o.user_id = matched_owner_id
            and o.status in ('active','trialing')
            and (o.ends_at is null or o.ends_at > now())
            and o.plan_id = 'artist_pro'
        )
        or exists (
          select 1 from public.billing_subscriptions s
          where s.user_id = matched_owner_id
            and s.status in ('active','trialing')
            and s.plan_id = 'artist_pro'
        );

      commission_bps_value := case
        when paid_access then policy.artist_paid_bps
        else policy.artist_free_bps
      end;
      policy_group := case when paid_access then 'artist_paid' else 'artist_free' end;
    else
      paid_access :=
        exists (
          select 1 from public.billing_entitlement_overrides o
          where o.user_id = matched_owner_id
            and o.status in ('active','trialing')
            and (o.ends_at is null or o.ends_at > now())
            and o.plan_id in ('label_starter','label_pro')
        )
        or exists (
          select 1 from public.billing_subscriptions s
          where s.user_id = matched_owner_id
            and s.status in ('active','trialing')
            and s.plan_id in ('label_starter','label_pro')
        );

      commission_bps_value := case
        when paid_access then policy.label_paid_bps
        else policy.label_free_bps
      end;
      policy_group := case when paid_access then 'label_paid' else 'label_free' end;
    end if;

    gross_value := r.amount_minor;
    commission_value := round((gross_value::numeric * commission_bps_value::numeric) / 10000)::bigint;
    net_value := gross_value - commission_value;

    if net_value = 0 then
      update public.royalty_import_rows
      set match_status = 'conflict',
          conflict_reason = 'owner_net_zero',
          release_id = matched_release_id,
          track_id = matched_track_id,
          owner_user_id = matched_owner_id,
          gross_amount_minor = gross_value,
          commission_bps = commission_bps_value,
          commission_minor = commission_value,
          owner_net_minor = net_value
      where id = r.id;
      continue;
    end if;

    insert into public.ledger_accounts (owner_user_id, currency, label)
    values (matched_owner_id, upper(r.currency), 'default')
    on conflict (owner_user_id, currency, label) do nothing;

    select id into acct_id from public.ledger_accounts
    where owner_user_id = matched_owner_id
      and currency = upper(r.currency)
      and label = 'default';

    insert into public.ledger_entries (
      account_id,
      owner_user_id,
      kind,
      amount_minor,
      currency,
      description,
      created_by,
      gross_minor,
      net_minor,
      fee_minor,
      source_provider,
      source_report_id,
      source_row_key,
      period_start,
      period_end,
      release_id,
      track_id,
      isrc,
      upc,
      territory,
      dsp_code,
      balance_bucket,
      import_row_id,
      metadata
    ) values (
      acct_id,
      matched_owner_id,
      case when net_value > 0 then 'royalty_credit'::public.money_entry_kind else 'royalty_debit'::public.money_entry_kind end,
      net_value,
      upper(r.currency),
      'Royalty import ' || r.source_provider || ' / ' || r.report_id,
      actor,
      gross_value,
      net_value,
      commission_value,
      r.source_provider,
      r.report_id,
      r.row_key,
      r.period_start,
      r.period_end,
      matched_release_id,
      matched_track_id,
      nullif(r.isrc, ''),
      nullif(r.upc, ''),
      r.territory,
      r.dsp_code,
      'available',
      r.id,
      jsonb_build_object(
        'commission_bps', commission_bps_value,
        'nexo_commission_minor', commission_value,
        'account_type', owner_account_type,
        'paid_access', paid_access,
        'commission_policy_group', policy_group
      )
    )
    on conflict (source_provider, source_report_id, source_row_key)
      where source_provider is not null and source_report_id is not null and source_row_key is not null
    do nothing
    returning id into entry_id;

    if entry_id is null then
      select id into entry_id from public.ledger_entries
      where source_provider = r.source_provider
        and source_report_id = r.report_id
        and source_row_key = r.row_key;
    end if;

    update public.royalty_import_rows
    set
      match_status = 'posted',
      conflict_reason = null,
      release_id = matched_release_id,
      track_id = matched_track_id,
      owner_user_id = matched_owner_id,
      posted_ledger_entry_id = entry_id,
      gross_amount_minor = gross_value,
      commission_bps = commission_bps_value,
      commission_minor = commission_value,
      owner_net_minor = net_value
    where id = r.id;
  end loop;

  update public.royalty_import_batches
  set
    row_count = (select count(*) from public.royalty_import_rows where batch_id = p_batch_id),
    matched_count = (select count(*) from public.royalty_import_rows where batch_id = p_batch_id and match_status in ('matched','posted')),
    conflict_count = (select count(*) from public.royalty_import_rows where batch_id = p_batch_id and match_status = 'conflict'),
    posted_count = (select count(*) from public.royalty_import_rows where batch_id = p_batch_id and match_status = 'posted'),
    status = case
      when exists (select 1 from public.royalty_import_rows where batch_id = p_batch_id and match_status in ('conflict','unmatched'))
        then 'partial'::public.royalty_import_status
      else 'completed'::public.royalty_import_status
    end,
    completed_at = now()
  where id = p_batch_id
  returning * into b;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    'royalty_import',
    'royalty_import_batch',
    b.id,
    jsonb_build_object(
      'operation', 'post',
      'rows', b.row_count,
      'posted', b.posted_count,
      'conflicts', b.conflict_count
    )
  );

  return b;
end;
$$;

revoke all on function public.post_royalty_import_batch(uuid) from public;
grant execute on function public.post_royalty_import_batch(uuid) to authenticated;
