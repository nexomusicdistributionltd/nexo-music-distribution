grant select on public.admin_policy_versions to authenticated;

drop policy if exists policy_versions_active_read on public.admin_policy_versions;
create policy policy_versions_active_read on public.admin_policy_versions
for select to authenticated
using (
  status='active'
  and (effective_at is null or effective_at <= now())
);

create or replace function public.accept_admin_policy_version(p_policy_version_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid := auth.uid();
  accepted timestamptz := now();
  policy_row public.admin_policy_versions;
begin
  if actor is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  select * into policy_row
  from public.admin_policy_versions
  where id=p_policy_version_id
    and status='active'
    and (effective_at is null or effective_at <= now());
  if not found then raise exception 'Policy version is not active' using errcode='P0001'; end if;

  insert into public.admin_policy_acceptances(policy_version_id,user_id,accepted_at,metadata)
  values (p_policy_version_id,actor,accepted,jsonb_build_object('source','portal'))
  on conflict (policy_version_id,user_id)
  do update set accepted_at=excluded.accepted_at,
                metadata=public.admin_policy_acceptances.metadata || excluded.metadata;

  return accepted;
end;
$$;
revoke all on function public.accept_admin_policy_version(uuid) from public,anon;
grant execute on function public.accept_admin_policy_version(uuid) to authenticated;

create or replace function public.nexo_outstanding_required_policy_count(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path=public
as $$
declare actor uuid := auth.uid();
declare result integer;
begin
  if actor is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  if actor <> p_user_id and not public.has_staff_permission(actor,'admin:compliance') then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  select count(*)::integer into result
  from public.admin_policy_versions v
  where v.status='active'
    and v.requires_reacceptance
    and (v.effective_at is null or v.effective_at <= now())
    and not exists (
      select 1 from public.admin_policy_acceptances a
      where a.policy_version_id=v.id and a.user_id=p_user_id
    );

  return coalesce(result,0);
end;
$$;
revoke all on function public.nexo_outstanding_required_policy_count(uuid) from public,anon;
grant execute on function public.nexo_outstanding_required_policy_count(uuid) to authenticated;
