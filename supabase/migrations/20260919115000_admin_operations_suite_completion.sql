create table if not exists public.admin_risk_signals (
  id uuid primary key default gen_random_uuid(),
  signal_key text not null unique,
  signal_type text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  subject_user_id uuid references public.profiles(id) on delete set null,
  release_id uuid references public.releases(id) on delete set null,
  track_id uuid references public.release_tracks(id) on delete set null,
  status text not null default 'open' check (status in ('open','reviewing','dismissed','resolved')),
  summary text not null,
  evidence jsonb not null default '{}'::jsonb,
  source text not null default 'auto',
  detected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists admin_risk_signals_status_idx on public.admin_risk_signals(status,severity,last_seen_at desc);

create table if not exists public.catalog_conflict_candidates (
  id uuid primary key default gen_random_uuid(),
  conflict_key text not null unique,
  conflict_type text not null check (conflict_type in ('duplicate_isrc','duplicate_upc')),
  identifier text not null,
  release_ids uuid[] not null default '{}'::uuid[],
  track_ids uuid[] not null default '{}'::uuid[],
  owner_user_ids uuid[] not null default '{}'::uuid[],
  status text not null default 'open' check (status in ('open','reviewing','evidence_requested','no_conflict','resolved')),
  linked_case_id uuid references public.admin_ops_cases(id) on delete set null,
  resolution_note text,
  resolved_by uuid references public.profiles(id) on delete set null,
  detected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists catalog_conflict_candidates_status_idx on public.catalog_conflict_candidates(status,conflict_type,last_seen_at desc);

create table if not exists public.admin_email_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 180),
  subject text not null check (char_length(subject) between 1 and 300),
  body_text text not null check (char_length(body_text) between 1 and 20000),
  body_html text not null check (char_length(body_html) between 1 and 100000),
  audience text not null check (audience in (
    'all','artists','labels','paid_artists','free_artists','paid_labels','free_labels','specific_user','country'
  )),
  target_user_id uuid references public.profiles(id) on delete set null,
  country_code text,
  status text not null default 'draft' check (status in ('draft','queued','processing','completed','partial_failed','cancelled')),
  recipient_count integer not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  queued_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((audience='specific_user' and target_user_id is not null) or audience<>'specific_user'),
  check ((audience='country' and country_code is not null) or audience<>'country')
);
create index if not exists admin_email_broadcasts_status_idx on public.admin_email_broadcasts(status,created_at desc);

create table if not exists public.admin_email_broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.admin_email_broadcasts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  outbound_event_id uuid references public.email_outbound_events(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (broadcast_id,user_id)
);
create index if not exists admin_email_broadcast_recipients_broadcast_idx on public.admin_email_broadcast_recipients(broadcast_id);

alter table public.admin_risk_signals enable row level security;
alter table public.catalog_conflict_candidates enable row level security;
alter table public.admin_email_broadcasts enable row level security;
alter table public.admin_email_broadcast_recipients enable row level security;

grant select,insert,update on public.admin_risk_signals to authenticated;
grant select,insert,update on public.catalog_conflict_candidates to authenticated;
grant select,insert,update on public.admin_email_broadcasts to authenticated;
grant select on public.admin_email_broadcast_recipients to authenticated;

drop policy if exists admin_risk_signals_staff on public.admin_risk_signals;
create policy admin_risk_signals_staff on public.admin_risk_signals
for all to authenticated using (
  public.has_staff_permission(auth.uid(),'admin:operations')
  or public.has_staff_permission(auth.uid(),'admin:compliance')
) with check (
  public.has_staff_permission(auth.uid(),'admin:operations')
  or public.has_staff_permission(auth.uid(),'admin:compliance')
);

drop policy if exists catalog_conflict_candidates_staff on public.catalog_conflict_candidates;
create policy catalog_conflict_candidates_staff on public.catalog_conflict_candidates
for all to authenticated using (
  public.has_staff_permission(auth.uid(),'admin:operations')
  or public.has_staff_permission(auth.uid(),'admin:compliance')
) with check (
  public.has_staff_permission(auth.uid(),'admin:operations')
  or public.has_staff_permission(auth.uid(),'admin:compliance')
);

drop policy if exists admin_email_broadcasts_staff on public.admin_email_broadcasts;
create policy admin_email_broadcasts_staff on public.admin_email_broadcasts
for all to authenticated
using (public.has_staff_permission(auth.uid(),'admin:notifications'))
with check (public.has_staff_permission(auth.uid(),'admin:notifications'));

drop policy if exists admin_email_broadcast_recipients_staff on public.admin_email_broadcast_recipients;
create policy admin_email_broadcast_recipients_staff on public.admin_email_broadcast_recipients
for select to authenticated
using (public.has_staff_permission(auth.uid(),'admin:notifications'));

create or replace function public.refresh_admin_risk_signals()
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := auth.uid(); scan_at timestamptz := clock_timestamp(); rec record; inserted_count integer := 0;
begin
  if actor is null or not (public.has_staff_permission(actor,'admin:operations') or public.has_staff_permission(actor,'admin:compliance')) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  for rec in
    select upper(btrim(t.isrc)) identifier,array_agg(distinct r.id) release_ids,array_agg(distinct t.id) track_ids,array_agg(distinct r.owner_user_id) owner_ids
    from public.release_tracks t join public.releases r on r.id=t.release_id
    where nullif(btrim(t.isrc),'') is not null
    group by upper(btrim(t.isrc)) having count(distinct r.owner_user_id)>1
  loop
    insert into public.admin_risk_signals(signal_key,signal_type,severity,summary,evidence,last_seen_at,updated_at)
    values('duplicate_isrc:'||rec.identifier,'duplicate_identifier','high','The same ISRC is attached to releases owned by different Nexo accounts.',jsonb_build_object('identifier',rec.identifier,'release_ids',rec.release_ids,'track_ids',rec.track_ids,'owner_user_ids',rec.owner_ids),scan_at,scan_at)
    on conflict(signal_key) do update set summary=excluded.summary,evidence=excluded.evidence,last_seen_at=scan_at,updated_at=scan_at,status=case when admin_risk_signals.status in ('dismissed','resolved') then admin_risk_signals.status else 'open' end;
    inserted_count := inserted_count + 1;
  end loop;
  for rec in
    select upper(btrim(r.upc)) identifier,array_agg(distinct r.id) release_ids,array_agg(distinct r.owner_user_id) owner_ids
    from public.releases r where nullif(btrim(r.upc),'') is not null
    group by upper(btrim(r.upc)) having count(distinct r.owner_user_id)>1
  loop
    insert into public.admin_risk_signals(signal_key,signal_type,severity,summary,evidence,last_seen_at,updated_at)
    values('duplicate_upc:'||rec.identifier,'duplicate_identifier','high','The same UPC is attached to releases owned by different Nexo accounts.',jsonb_build_object('identifier',rec.identifier,'release_ids',rec.release_ids,'owner_user_ids',rec.owner_ids),scan_at,scan_at)
    on conflict(signal_key) do update set summary=excluded.summary,evidence=excluded.evidence,last_seen_at=scan_at,updated_at=scan_at,status=case when admin_risk_signals.status in ('dismissed','resolved') then admin_risk_signals.status else 'open' end;
    inserted_count := inserted_count + 1;
  end loop;
  for rec in
    select p.owner_user_id,count(*) cnt,array_agg(p.id) request_ids
    from public.payout_requests p where p.created_at>now()-interval '24 hours' and lower(coalesce(p.status,'')) not in ('paid','completed','rejected','cancelled','failed')
    group by p.owner_user_id having count(*)>=3
  loop
    insert into public.admin_risk_signals(signal_key,signal_type,severity,subject_user_id,summary,evidence,last_seen_at,updated_at)
    values('payout_velocity:'||rec.owner_user_id::text,'payout_velocity','medium',rec.owner_user_id,'Three or more active payout requests were created by this account within 24 hours.',jsonb_build_object('count',rec.cnt,'request_ids',rec.request_ids),scan_at,scan_at)
    on conflict(signal_key) do update set subject_user_id=excluded.subject_user_id,summary=excluded.summary,evidence=excluded.evidence,last_seen_at=scan_at,updated_at=scan_at,status=case when admin_risk_signals.status in ('dismissed','resolved') then admin_risk_signals.status else 'open' end;
    inserted_count := inserted_count + 1;
  end loop;
  for rec in
    select r.owner_user_id,count(*) cnt,array_agg(j.id) job_ids
    from public.distribution_jobs j join public.releases r on r.id=j.release_id
    where j.status::text='failed' and j.updated_at>now()-interval '24 hours'
    group by r.owner_user_id having count(*)>=3
  loop
    insert into public.admin_risk_signals(signal_key,signal_type,severity,subject_user_id,summary,evidence,last_seen_at,updated_at)
    values('distribution_failure_burst:'||rec.owner_user_id::text,'distribution_failure_burst','low',rec.owner_user_id,'Three or more distribution jobs failed for this account within 24 hours. Review whether the cause is technical, metadata-related, or abusive.',jsonb_build_object('count',rec.cnt,'job_ids',rec.job_ids),scan_at,scan_at)
    on conflict(signal_key) do update set subject_user_id=excluded.subject_user_id,summary=excluded.summary,evidence=excluded.evidence,last_seen_at=scan_at,updated_at=scan_at,status=case when admin_risk_signals.status in ('dismissed','resolved') then admin_risk_signals.status else 'open' end;
    inserted_count := inserted_count + 1;
  end loop;
  for rec in
    select v.user_id,count(*) cnt,array_agg(s.id) signal_ids
    from public.identity_verification_risk_signals s join public.identity_verifications v on v.id=s.verification_id
    where lower(coalesce(s.severity,'')) in ('high','critical')
    group by v.user_id having count(*)>=1
  loop
    insert into public.admin_risk_signals(signal_key,signal_type,severity,subject_user_id,summary,evidence,last_seen_at,updated_at)
    values('identity_risk:'||rec.user_id::text,'identity_risk','high',rec.user_id,'Identity verification contains one or more high-severity risk signals requiring staff review.',jsonb_build_object('count',rec.cnt,'identity_signal_ids',rec.signal_ids),scan_at,scan_at)
    on conflict(signal_key) do update set subject_user_id=excluded.subject_user_id,summary=excluded.summary,evidence=excluded.evidence,last_seen_at=scan_at,updated_at=scan_at,status=case when admin_risk_signals.status in ('dismissed','resolved') then admin_risk_signals.status else 'open' end;
    inserted_count := inserted_count + 1;
  end loop;
  update public.admin_risk_signals set status='resolved',updated_at=scan_at where source='auto' and status='open' and last_seen_at<scan_at;
  return jsonb_build_object('scan_at',scan_at,'signals_seen',inserted_count);
end;
$$;

create or replace function public.refresh_catalog_conflict_candidates()
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := auth.uid(); scan_at timestamptz := clock_timestamp(); rec record; seen_count integer := 0;
begin
  if actor is null or not (public.has_staff_permission(actor,'admin:operations') or public.has_staff_permission(actor,'admin:compliance')) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  for rec in
    select upper(btrim(r.upc)) identifier,array_agg(distinct r.id) release_ids,array_agg(distinct r.owner_user_id) owner_ids
    from public.releases r where nullif(btrim(r.upc),'') is not null group by upper(btrim(r.upc)) having count(distinct r.owner_user_id)>1
  loop
    insert into public.catalog_conflict_candidates(conflict_key,conflict_type,identifier,release_ids,owner_user_ids,last_seen_at,updated_at)
    values('upc:'||rec.identifier,'duplicate_upc',rec.identifier,rec.release_ids,rec.owner_ids,scan_at,scan_at)
    on conflict(conflict_key) do update set release_ids=excluded.release_ids,owner_user_ids=excluded.owner_user_ids,last_seen_at=scan_at,updated_at=scan_at,status=case when catalog_conflict_candidates.status in ('no_conflict','resolved') then catalog_conflict_candidates.status else 'open' end;
    seen_count := seen_count + 1;
  end loop;
  for rec in
    select upper(btrim(t.isrc)) identifier,array_agg(distinct r.id) release_ids,array_agg(distinct t.id) track_ids,array_agg(distinct r.owner_user_id) owner_ids
    from public.release_tracks t join public.releases r on r.id=t.release_id
    where nullif(btrim(t.isrc),'') is not null group by upper(btrim(t.isrc)) having count(distinct r.owner_user_id)>1
  loop
    insert into public.catalog_conflict_candidates(conflict_key,conflict_type,identifier,release_ids,track_ids,owner_user_ids,last_seen_at,updated_at)
    values('isrc:'||rec.identifier,'duplicate_isrc',rec.identifier,rec.release_ids,rec.track_ids,rec.owner_ids,scan_at,scan_at)
    on conflict(conflict_key) do update set release_ids=excluded.release_ids,track_ids=excluded.track_ids,owner_user_ids=excluded.owner_user_ids,last_seen_at=scan_at,updated_at=scan_at,status=case when catalog_conflict_candidates.status in ('no_conflict','resolved') then catalog_conflict_candidates.status else 'open' end;
    seen_count := seen_count + 1;
  end loop;
  update public.catalog_conflict_candidates set status='resolved',resolution_note=coalesce(resolution_note,'No longer detected by identifier scan.'),updated_at=scan_at where status='open' and last_seen_at<scan_at;
  return jsonb_build_object('scan_at',scan_at,'conflicts_seen',seen_count);
end;
$$;

create or replace function public.queue_admin_email_broadcast(p_broadcast_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); b public.admin_email_broadcasts; rec record; recipient_id uuid; event_id uuid; total integer:=0;
begin
  if actor is null or not public.has_staff_permission(actor,'admin:notifications') then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into b from public.admin_email_broadcasts where id=p_broadcast_id for update;
  if not found then raise exception 'Broadcast not found' using errcode='P0002'; end if;
  if b.status not in ('draft','queued','partial_failed') then raise exception 'Broadcast cannot be queued from status %',b.status using errcode='P0001'; end if;
  for rec in
    select p.id,p.email from public.profiles p
    where nullif(btrim(p.email),'') is not null and p.account_status::text<>'deactivated'
      and not exists(select 1 from public.email_suppressions s where s.email=lower(btrim(p.email)) and s.active)
      and (
        b.audience='all' or (b.audience='specific_user' and p.id=b.target_user_id)
        or (b.audience='country' and upper(coalesce(p.country,''))=upper(coalesce(b.country_code,'')))
        or (b.audience='artists' and p.account_type='artist')
        or (b.audience='labels' and p.account_type='label')
        or (b.audience='paid_artists' and p.account_type='artist' and public.nexo_user_has_paid_access(p.id))
        or (b.audience='free_artists' and p.account_type='artist' and not public.nexo_user_has_paid_access(p.id))
        or (b.audience='paid_labels' and p.account_type='label' and public.nexo_user_has_paid_access(p.id))
        or (b.audience='free_labels' and p.account_type='label' and not public.nexo_user_has_paid_access(p.id))
      )
  loop
    recipient_id:=null;
    insert into public.admin_email_broadcast_recipients(broadcast_id,user_id,email)
    values(b.id,rec.id,lower(btrim(rec.email))) on conflict(broadcast_id,user_id) do nothing returning id into recipient_id;
    if recipient_id is null then continue; end if;
    insert into public.email_outbound_events(to_email,template_key,payload,status,related_entity_type,related_entity_id)
    values(lower(btrim(rec.email)),'ADMIN_BROADCAST',
      jsonb_build_object('_event_type','admin.broadcast','_recipient_user_id',rec.id::text,'_idempotency_key','ADMIN_BROADCAST:'||b.id::text||':'||rec.id::text,'subject',b.subject,'html',b.body_html),
      'queued','admin_email_broadcast',b.id) returning id into event_id;
    update public.admin_email_broadcast_recipients set outbound_event_id=event_id where id=recipient_id;
    total:=total+1;
  end loop;
  update public.admin_email_broadcasts
  set status=case when total=0 then 'completed' else 'queued' end,
      recipient_count=(select count(*) from public.admin_email_broadcast_recipients where broadcast_id=b.id),
      queued_at=coalesce(queued_at,now()),completed_at=case when total=0 then now() else null end,updated_at=now()
  where id=b.id;
  return total;
end;
$$;

create or replace function public.execute_release_ownership_reassignment(p_request_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); req public.admin_high_risk_requests; v_release uuid; v_target uuid; v_candidate uuid; old_owner uuid;
begin
  if actor is null or not (public.has_staff_permission(actor,'admin:operations') or public.has_staff_permission(actor,'admin:compliance')) then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into req from public.admin_high_risk_requests where id=p_request_id for update;
  if not found then raise exception 'Approval request not found' using errcode='P0002'; end if;
  if req.action_type<>'release_ownership_reassignment' or req.status<>'approved' or req.reviewed_by is null then raise exception 'A second-admin approved ownership request is required' using errcode='P0001'; end if;
  v_release:=nullif(req.payload->>'release_id','')::uuid;
  v_target:=nullif(req.payload->>'target_owner_user_id','')::uuid;
  v_candidate:=case when coalesce(req.payload->>'candidate_id','')<>'' then (req.payload->>'candidate_id')::uuid else null end;
  if v_release is null or v_target is null then raise exception 'Approved request payload is incomplete' using errcode='22023'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_target and p.account_type in ('artist','label')) then raise exception 'Target owner must be an artist or label account' using errcode='22023'; end if;
  select owner_user_id into old_owner from public.releases where id=v_release for update;
  if old_owner is null then raise exception 'Release not found' using errcode='P0002'; end if;
  update public.releases set owner_user_id=v_target,updated_at=now() where id=v_release;
  update public.admin_high_risk_requests set status='executed',execution_note=coalesce(execution_note,'Approved release ownership reassignment executed.'),updated_at=now() where id=req.id;
  if v_candidate is not null then
    update public.catalog_conflict_candidates set status='resolved',resolution_note='Ownership reassigned through approved high-risk request '||req.id::text,resolved_by=actor,updated_at=now() where id=v_candidate;
  end if;
  return v_release;
end;
$$;

revoke all on function public.refresh_admin_risk_signals() from public,anon;
revoke all on function public.refresh_catalog_conflict_candidates() from public,anon;
revoke all on function public.queue_admin_email_broadcast(uuid) from public,anon;
revoke all on function public.execute_release_ownership_reassignment(uuid) from public,anon;
grant execute on function public.refresh_admin_risk_signals() to authenticated;
grant execute on function public.refresh_catalog_conflict_candidates() to authenticated;
grant execute on function public.queue_admin_email_broadcast(uuid) to authenticated;
grant execute on function public.execute_release_ownership_reassignment(uuid) to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='admin_risk_signals') then alter publication supabase_realtime add table public.admin_risk_signals; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='catalog_conflict_candidates') then alter publication supabase_realtime add table public.catalog_conflict_candidates; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='admin_email_broadcasts') then alter publication supabase_realtime add table public.admin_email_broadcasts; end if;
end $$;