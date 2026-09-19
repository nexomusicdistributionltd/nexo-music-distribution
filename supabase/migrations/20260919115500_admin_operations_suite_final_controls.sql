create or replace function public.admin_high_risk_action_allowed(p_actor uuid, p_action_type text)
returns boolean language sql stable security definer set search_path=public as $$
  select case
    when p_actor is null then false
    when public.has_staff_permission(p_actor,'admin:operations') then true
    when p_action_type='royalty_commission_change' then public.has_staff_permission(p_actor,'admin:royalties')
    when p_action_type='release_ownership_reassignment' then public.has_staff_permission(p_actor,'admin:compliance')
    when p_action_type='bulk_release_takedown' then public.has_staff_permission(p_actor,'admin:distribution')
    when p_action_type='account_status_destructive' then public.has_staff_permission(p_actor,'admin:users')
    else false
  end;
$$;
revoke all on function public.admin_high_risk_action_allowed(uuid,text) from public,anon;
grant execute on function public.admin_high_risk_action_allowed(uuid,text) to authenticated;

create or replace function public.create_admin_high_risk_request(
  p_action_type text,p_target_type text default null,p_target_id text default null,
  p_payload jsonb default '{}'::jsonb,p_reason text default null
)
returns public.admin_high_risk_requests language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); created public.admin_high_risk_requests;
begin
  if actor is null or not public.admin_high_risk_action_allowed(actor,p_action_type) then raise exception 'Not authorized' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_action_type,'')),'') is null or nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'Action type and reason are required' using errcode='22023'; end if;
  insert into public.admin_high_risk_requests(action_type,target_type,target_id,payload,reason,status,requested_by)
  values(btrim(p_action_type),nullif(btrim(coalesce(p_target_type,'')),''),nullif(btrim(coalesce(p_target_id,'')),''),coalesce(p_payload,'{}'::jsonb),btrim(p_reason),'pending',actor)
  returning * into created;
  return created;
end;
$$;

create or replace function public.review_admin_high_risk_request(
  p_id uuid,p_status text,p_execution_note text default null
)
returns public.admin_high_risk_requests language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); current_row public.admin_high_risk_requests; updated_row public.admin_high_risk_requests;
begin
  if actor is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  if p_status not in ('approved','rejected','cancelled') then raise exception 'Invalid review status' using errcode='22023'; end if;
  select * into current_row from public.admin_high_risk_requests where id=p_id for update;
  if not found then raise exception 'Request not found' using errcode='P0002'; end if;
  if not public.admin_high_risk_action_allowed(actor,current_row.action_type) then raise exception 'Not authorized' using errcode='42501'; end if;
  if current_row.status<>'pending' then raise exception 'Request is no longer pending' using errcode='P0001'; end if;
  if current_row.requested_by=actor then raise exception 'Requester cannot approve or reject their own high-risk request' using errcode='42501'; end if;
  update public.admin_high_risk_requests
  set status=p_status,reviewed_by=actor,reviewed_at=now(),execution_note=nullif(btrim(coalesce(p_execution_note,'')),''),updated_at=now()
  where id=p_id returning * into updated_row;
  return updated_row;
end;
$$;

create or replace function public.mark_admin_high_risk_request_executed(
  p_id uuid,p_note text default null
)
returns public.admin_high_risk_requests language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); current_row public.admin_high_risk_requests; updated_row public.admin_high_risk_requests;
begin
  if actor is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  select * into current_row from public.admin_high_risk_requests where id=p_id for update;
  if not found then raise exception 'Request not found' using errcode='P0002'; end if;
  if current_row.status<>'approved' or current_row.reviewed_by is null then raise exception 'Request must be approved by a second administrator before execution' using errcode='P0001'; end if;
  if not public.admin_high_risk_action_allowed(actor,current_row.action_type) then raise exception 'Not authorized' using errcode='42501'; end if;
  update public.admin_high_risk_requests
  set status='executed',execution_note=coalesce(nullif(btrim(coalesce(p_note,'')),''),execution_note),updated_at=now()
  where id=p_id returning * into updated_row;
  return updated_row;
end;
$$;

create or replace function public.execute_bulk_takedown_request(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); req public.admin_high_risk_requests; release_text text; reason_text text; completed integer:=0;
begin
  if actor is null or not public.admin_high_risk_action_allowed(actor,'bulk_release_takedown') then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into req from public.admin_high_risk_requests where id=p_request_id for update;
  if not found then raise exception 'Approval request not found' using errcode='P0002'; end if;
  if req.action_type<>'bulk_release_takedown' or req.status<>'approved' or req.reviewed_by is null then raise exception 'A second-admin approved bulk takedown request is required' using errcode='P0001'; end if;
  if jsonb_typeof(req.payload->'release_ids')<>'array' then raise exception 'Approved request is missing release_ids' using errcode='22023'; end if;
  reason_text:=coalesce(nullif(req.payload->>'reason',''),req.reason);
  for release_text in select jsonb_array_elements_text(req.payload->'release_ids') loop
    perform public.request_distribution_takedown(release_text::uuid,reason_text);
    completed:=completed+1;
  end loop;
  update public.admin_high_risk_requests
  set status='executed',execution_note='Approved bulk takedown recorded for '||completed::text||' release(s). Provider execution remains visible in Distribution operations.',updated_at=now()
  where id=req.id;
  return jsonb_build_object('request_id',req.id,'release_count',completed);
end;
$$;

create or replace function public.nexo_required_policies_satisfied(p_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.nexo_outstanding_required_policy_count(p_user_id)=0;
$$;

revoke all on function public.create_admin_high_risk_request(text,text,text,jsonb,text) from public,anon;
revoke all on function public.review_admin_high_risk_request(uuid,text,text) from public,anon;
revoke all on function public.mark_admin_high_risk_request_executed(uuid,text) from public,anon;
revoke all on function public.execute_bulk_takedown_request(uuid) from public,anon;
revoke all on function public.nexo_required_policies_satisfied(uuid) from public,anon;
grant execute on function public.create_admin_high_risk_request(text,text,text,jsonb,text) to authenticated;
grant execute on function public.review_admin_high_risk_request(uuid,text,text) to authenticated;
grant execute on function public.mark_admin_high_risk_request_executed(uuid,text) to authenticated;
grant execute on function public.execute_bulk_takedown_request(uuid) to authenticated;
grant execute on function public.nexo_required_policies_satisfied(uuid) to authenticated;
