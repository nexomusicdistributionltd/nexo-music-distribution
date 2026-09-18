-- NEXO royalty import reconciliation/posting.
-- Confirmed provider rows are matched to owned catalog, commission is frozen at posting time,
-- and only the owner's net amount becomes available balance. Raw analytics never post themselves.

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
  candidate_count integer;
  matched_release uuid;
  matched_track uuid;
  matched_owner uuid;
  acct uuid;
  entry public.ledger_entries;
  paid_access boolean;
  commission_bps integer;
  commission_minor bigint;
  owner_net bigint;
  paid_bps integer;
  free_bps integer;
begin
  if actor is null or not (
    public.has_role(actor,'admin') or public.has_role(actor,'super_admin')
  ) then
    raise exception 'Administrator access required' using errcode='42501';
  end if;

  select * into b
  from public.royalty_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'Royalty import batch not found' using errcode='P0002';
  end if;

  select paid_plan_bps, free_plan_bps
  into paid_bps, free_bps
  from public.royalty_commission_policy
  where id='default';

  paid_bps := coalesce(paid_bps,1000);
  free_bps := coalesce(free_bps,2000);

  update public.royalty_import_batches
  set status='processing', error_summary=null
  where id=b.id;

  for r in
    select *
    from public.royalty_import_rows
    where batch_id=b.id
      and match_status <> 'posted'
    order by created_at,id
    for update
  loop
    matched_release := null;
    matched_track := null;
    matched_owner := null;
    candidate_count := 0;

    if r.amount_minor is null or r.amount_minor < 0 then
      update public.royalty_import_rows
      set match_status='conflict',
          conflict_reason='Royalty amount must be a confirmed non-negative minor-unit amount before posting.'
      where id=r.id;
      continue;
    end if;

    if r.currency is null or trim(r.currency::text) !~ '^[A-Za-z]{3}$' then
      update public.royalty_import_rows
      set match_status='conflict',
          conflict_reason='A valid three-letter currency is required before posting.'
      where id=r.id;
      continue;
    end if;

    if nullif(trim(coalesce(r.isrc,'')),'') is not null then
      select count(*), min(t.id), min(rel.id), min(rel.owner_user_id)
      into candidate_count, matched_track, matched_release, matched_owner
      from public.release_tracks t
      join public.releases rel on rel.id=t.release_id
      where upper(replace(trim(t.isrc),'-','')) =
            upper(replace(trim(r.isrc),'-',''));

      if candidate_count > 1 then
        update public.royalty_import_rows
        set match_status='conflict',
            conflict_reason='ISRC matched more than one catalog track; administrator review required.'
        where id=r.id;
        continue;
      end if;
    end if;

    if candidate_count = 0 and nullif(trim(coalesce(r.upc,'')),'') is not null then
      select count(*), min(rel.id), min(rel.owner_user_id)
      into candidate_count, matched_release, matched_owner
      from public.releases rel
      where regexp_replace(coalesce(rel.upc,''),'[^0-9]','','g') =
            regexp_replace(coalesce(r.upc,''),'[^0-9]','','g')
        and regexp_replace(coalesce(r.upc,''),'[^0-9]','','g') <> '';

      matched_track := null;

      if candidate_count > 1 then
        update public.royalty_import_rows
        set match_status='conflict',
            conflict_reason='UPC matched more than one catalog release; administrator review required.'
        where id=r.id;
        continue;
      end if;
    end if;

    if candidate_count = 0 or matched_owner is null then
      update public.royalty_import_rows
      set match_status='unmatched',
          conflict_reason='No unique catalog match found by ISRC or UPC.'
      where id=r.id;
      continue;
    end if;

    paid_access := false;

    if exists (
      select 1
      from public.billing_entitlement_overrides o
      where o.user_id=matched_owner
        and o.starts_at <= now()
        and (o.ends_at is null or o.ends_at > now())
        and o.status in ('active','trialing')
        and o.plan_id <> 'artist_starter'
    ) then
      paid_access := true;
    elsif exists (
      select 1
      from public.billing_entitlement_overrides o
      where o.user_id=matched_owner
        and o.starts_at <= now()
        and (o.ends_at is null or o.ends_at > now())
        and o.status in ('active','trialing')
        and o.plan_id = 'artist_starter'
    ) then
      paid_access := false;
    elsif exists (
      select 1
      from public.billing_subscriptions s
      where s.user_id=matched_owner
        and s.status in ('active','trialing')
        and (s.current_period_ends_at is null or s.current_period_ends_at > now())
    ) then
      paid_access := true;
    end if;

    commission_bps := case when paid_access then paid_bps else free_bps end;
    commission_minor := round(r.amount_minor::numeric * commission_bps::numeric / 10000)::bigint;
    owner_net := r.amount_minor - commission_minor;

    insert into public.ledger_accounts(owner_user_id,currency,label)
    values(matched_owner,upper(r.currency::text),'default')
    on conflict(owner_user_id,currency,label) do nothing;

    select id into acct
    from public.ledger_accounts
    where owner_user_id=matched_owner
      and currency=upper(r.currency::text)
      and label='default';

    insert into public.ledger_entries(
      account_id, owner_user_id, kind, amount_minor, currency, description,
      created_by, gross_minor, net_minor, fee_minor,
      source_provider, source_report_id, source_row_key,
      period_start, period_end, release_id, track_id,
      isrc, upc, territory, dsp_code,
      balance_bucket, import_row_id, metadata
    )
    values(
      acct, matched_owner, 'royalty_credit', owner_net, upper(r.currency::text),
      'Royalty earnings after Nexo distribution commission',
      actor, r.amount_minor, owner_net, commission_minor,
      r.source_provider, r.report_id, r.row_key,
      r.period_start, r.period_end, matched_release, matched_track,
      nullif(trim(r.isrc),''), nullif(trim(r.upc),''),
      r.territory, r.dsp_code,
      'available', r.id,
      jsonb_build_object(
        'commission_bps', commission_bps,
        'commission_minor', commission_minor,
        'gross_amount_minor', r.amount_minor,
        'paid_plan_access', paid_access
      )
    )
    on conflict(source_provider,source_report_id,source_row_key)
    where source_provider is not null and source_report_id is not null and source_row_key is not null
    do nothing
    returning * into entry;

    if entry.id is null then
      select * into entry
      from public.ledger_entries
      where source_provider=r.source_provider
        and source_report_id=r.report_id
        and source_row_key=r.row_key;
    end if;

    if entry.id is null then
      update public.royalty_import_rows
      set match_status='conflict',
          conflict_reason='Could not create or resolve idempotent ledger entry.'
      where id=r.id;
      continue;
    end if;

    update public.royalty_import_rows
    set match_status='posted',
        conflict_reason=null,
        release_id=matched_release,
        track_id=matched_track,
        owner_user_id=matched_owner,
        posted_ledger_entry_id=entry.id,
        gross_amount_minor=r.amount_minor,
        commission_bps=commission_bps,
        commission_minor=commission_minor,
        owner_net_minor=owner_net
    where id=r.id;
  end loop;

  update public.royalty_import_batches b2
  set row_count=(select count(*) from public.royalty_import_rows x where x.batch_id=b2.id),
      matched_count=(select count(*) from public.royalty_import_rows x where x.batch_id=b2.id and x.match_status in ('matched','posted')),
      conflict_count=(select count(*) from public.royalty_import_rows x where x.batch_id=b2.id and x.match_status='conflict'),
      posted_count=(select count(*) from public.royalty_import_rows x where x.batch_id=b2.id and x.match_status='posted'),
      status=case
        when exists(select 1 from public.royalty_import_rows x where x.batch_id=b2.id and x.match_status in ('conflict','unmatched')) then 'partial'::public.royalty_import_status
        else 'completed'::public.royalty_import_status
      end,
      completed_at=case
        when not exists(select 1 from public.royalty_import_rows x where x.batch_id=b2.id and x.match_status in ('conflict','unmatched')) then now()
        else null
      end,
      error_summary=case
        when exists(select 1 from public.royalty_import_rows x where x.batch_id=b2.id and x.match_status in ('conflict','unmatched'))
          then 'Some rows require administrator review before they can be posted.'
        else null
      end
  where b2.id=b.id
  returning * into b;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(
    actor,'royalty_import','royalty_import_batch',b.id,
    jsonb_build_object(
      'posted_count',b.posted_count,
      'conflict_count',b.conflict_count,
      'matched_count',b.matched_count,
      'status',b.status::text
    )
  );

  return b;
end;
$$;

revoke all on function public.post_royalty_import_batch(uuid) from public;
grant execute on function public.post_royalty_import_batch(uuid) to authenticated;
