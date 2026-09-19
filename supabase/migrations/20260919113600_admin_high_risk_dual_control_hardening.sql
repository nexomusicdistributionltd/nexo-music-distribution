revoke insert, update, delete on public.admin_high_risk_requests from authenticated;
grant select on public.admin_high_risk_requests to authenticated;

drop policy if exists high_risk_staff on public.admin_high_risk_requests;
drop policy if exists high_risk_select on public.admin_high_risk_requests;
create policy high_risk_select on public.admin_high_risk_requests
for select to authenticated
using (
  public.has_staff_permission(auth.uid(),'admin:operations')
  or (action_type='royalty_commission_change' and public.has_staff_permission(auth.uid(),'admin:royalties'))
);

create or replace function public.create_admin_high_risk_request(
  p_action_type text,
  p_target_type text default null,
  p_target_id text default null,
  p_payload jsonb default '{}'::jsonb,
  p_reason text default null
)
returns public.admin_high_risk_requests
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid := auth.uid();
  created public.admin_high_risk_requests;
begin
  if actor is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  if not (
    public.has_staff_permission(actor,'admin:operations')
    or (p_action_type='royalty_commission_change' and public.has_staff_permission(actor,'admin:royalties'))
  ) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if nullif(btrim(coalesce(p_action_type,'')),'') is null or nullif(btrim(coalesce(p_reason,'')),'') is null then
    raise exception 'Action type and reason are required' using errcode='22023';
  end if;

  insert into public.admin_high_risk_requests(
    action_type,target_type,target_id,payload,reason,status,requested_by
  ) values (
    btrim(p_action_type),nullif(btrim(coalesce(p_target_type,'')),''),
    nullif(btrim(coalesce(p_target_id,'')),''),
    coalesce(p_payload,'{}'::jsonb),btrim(p_reason),'pending',actor
  )
  returning * into created;
  return created;
end;
$$;

create or replace function public.review_admin_high_risk_request(
  p_id uuid,
  p_status text,
  p_execution_note text default null
)
returns public.admin_high_risk_requests
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid := auth.uid();
  current_row public.admin_high_risk_requests;
  updated_row public.admin_high_risk_requests;
begin
  if actor is null or not public.has_staff_permission(actor,'admin:operations') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_status not in ('approved','rejected','cancelled') then
    raise exception 'Invalid review status' using errcode='22023';
  end if;

  select * into current_row from public.admin_high_risk_requests where id=p_id for update;
  if not found then raise exception 'Request not found' using errcode='P0002'; end if;
  if current_row.status <> 'pending' then raise exception 'Request is no longer pending' using errcode='P0001'; end if;
  if current_row.requested_by=actor then
    raise exception 'Requester cannot approve or reject their own high-risk request' using errcode='42501';
  end if;

  update public.admin_high_risk_requests
  set status=p_status,reviewed_by=actor,reviewed_at=now(),
      execution_note=nullif(btrim(coalesce(p_execution_note,'')),''),
      updated_at=now()
  where id=p_id
  returning * into updated_row;
  return updated_row;
end;
$$;

create or replace function public.mark_admin_high_risk_request_executed(
  p_id uuid,
  p_note text default null
)
returns public.admin_high_risk_requests
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid := auth.uid();
  current_row public.admin_high_risk_requests;
  updated_row public.admin_high_risk_requests;
begin
  if actor is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  select * into current_row from public.admin_high_risk_requests where id=p_id for update;
  if not found then raise exception 'Request not found' using errcode='P0002'; end if;
  if current_row.status <> 'approved' or current_row.reviewed_by is null then
    raise exception 'Request must be approved by a second administrator before execution' using errcode='P0001';
  end if;
  if not (
    public.has_staff_permission(actor,'admin:operations')
    or (current_row.action_type='royalty_commission_change' and public.has_staff_permission(actor,'admin:royalties'))
  ) then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  update public.admin_high_risk_requests
  set status='executed',
      execution_note=coalesce(nullif(btrim(coalesce(p_note,'')),''),execution_note),
      updated_at=now()
  where id=p_id
  returning * into updated_row;
  return updated_row;
end;
$$;

revoke all on function public.create_admin_high_risk_request(text,text,text,jsonb,text) from public,anon;
revoke all on function public.review_admin_high_risk_request(uuid,text,text) from public,anon;
revoke all on function public.mark_admin_high_risk_request_executed(uuid,text) from public,anon;
grant execute on function public.create_admin_high_risk_request(text,text,text,jsonb,text) to authenticated;
grant execute on function public.review_admin_high_risk_request(uuid,text,text) to authenticated;
grant execute on function public.mark_admin_high_risk_request_executed(uuid,text) to authenticated;
