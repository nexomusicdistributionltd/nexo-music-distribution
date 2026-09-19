drop policy if exists high_risk_select on public.admin_high_risk_requests;
create policy high_risk_select on public.admin_high_risk_requests
for select to authenticated
using (public.admin_high_risk_action_allowed(auth.uid(), action_type));

create or replace function public.execute_approved_account_status_request(p_request_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid := auth.uid();
  req public.admin_high_risk_requests;
  target uuid;
  target_status public.account_status;
  restriction public.account_restriction_kind;
  result public.profiles;
begin
  if actor is null or not public.admin_high_risk_action_allowed(actor,'account_status_destructive') then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  select * into req from public.admin_high_risk_requests where id=p_request_id for update;
  if not found then raise exception 'Approval request not found' using errcode='P0002'; end if;
  if req.action_type<>'account_status_destructive' or req.status<>'approved' or req.reviewed_by is null then
    raise exception 'A second-admin approved account-status request is required' using errcode='P0001';
  end if;

  target := nullif(req.payload->>'user_id','')::uuid;
  target_status := nullif(req.payload->>'status','')::public.account_status;
  restriction := coalesce(
    nullif(req.payload->>'restriction','')::public.account_restriction_kind,
    'none'::public.account_restriction_kind
  );

  if target is null or target_status not in ('suspended'::public.account_status,'deactivated'::public.account_status) then
    raise exception 'Approved request payload is incomplete or not destructive' using errcode='22023';
  end if;

  result := public.admin_set_account_status(target,target_status,req.reason,restriction);

  update public.admin_high_risk_requests
  set status='executed',
      execution_note=coalesce(execution_note,'Approved account status change executed.'),
      updated_at=now()
  where id=req.id;

  return result;
end;
$$;

revoke all on function public.execute_approved_account_status_request(uuid) from public,anon;
grant execute on function public.execute_approved_account_status_request(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='admin_email_broadcast_recipients'
  ) then
    alter publication supabase_realtime add table public.admin_email_broadcast_recipients;
  end if;
end $$;
