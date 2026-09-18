-- Post imported master royalties into the immutable ledger with Nexo commission.
-- Paid access: 10% commission. Free/no-paid-access: 20% commission.
-- Matching is fail-closed: exact ISRC first, UPC fallback, conflicts are never posted.

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
  if actor is null or not (
    public.has_role(actor, 'admin') or public.has_role(actor, 'super_admin')
  ) then
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

    paid_access :=
      exists (
        select 1 from public.billing_entitlement_overrides o
        where o.user_id = matched_owner_id
          and o.status in ('active','trialing')
          and (o.ends_at is null or o.ends_at > now())
          and o.plan_id in ('artist_pro','label_starter','label_pro')
      )
      or exists (
        select 1 from public.billing_subscriptions s
        where s.user_id = matched_owner_id
          and s.status in ('active','trialing')
          and s.plan_id in ('artist_pro','label_starter','label_pro')
      );

    commission_bps_value := case
      when paid_access then policy.paid_plan_bps
      else policy.free_plan_bps
    end;

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
        'paid_access', paid_access
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
