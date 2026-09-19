create or replace function public.nexo_user_has_paid_access(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    exists (
      select 1 from public.billing_entitlement_overrides o
      where o.user_id=p_user_id
        and o.status in ('active','trialing')
        and (o.ends_at is null or o.ends_at>now())
        and o.plan_id in ('artist_pro','label_starter','label_pro')
    )
    or exists (
      select 1 from public.billing_subscriptions s
      where s.user_id=p_user_id
        and s.status in ('active','trialing')
        and s.plan_id in ('artist_pro','label_starter','label_pro')
    );
$$;
revoke all on function public.nexo_user_has_paid_access(uuid) from public,anon;
grant execute on function public.nexo_user_has_paid_access(uuid) to authenticated;

create or replace function public.nexo_user_operational_holds(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  if actor <> p_user_id and not public.has_staff_permission(actor,'admin:operations') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  return jsonb_build_object(
    'payout_hold',
      exists(select 1 from public.admin_ops_cases c where c.subject_user_id=p_user_id and c.payout_hold and c.status not in ('resolved','closed'))
      or exists(select 1 from public.tax_compliance_profiles t where t.user_id=p_user_id and t.hold_payouts),
    'distribution_hold',
      exists(select 1 from public.admin_ops_cases c where c.subject_user_id=p_user_id and c.distribution_hold and c.status not in ('resolved','closed')),
    'tax_hold',
      exists(select 1 from public.tax_compliance_profiles t where t.user_id=p_user_id and t.hold_payouts),
    'active_case_count',
      (select count(*) from public.admin_ops_cases c where c.subject_user_id=p_user_id and c.status not in ('resolved','closed'))
  );
end;
$$;
revoke all on function public.nexo_user_operational_holds(uuid) from public,anon;
grant execute on function public.nexo_user_operational_holds(uuid) to authenticated;

drop policy if exists admin_announcements_targeted_read on public.admin_announcements;
create policy admin_announcements_targeted_read on public.admin_announcements
for select to authenticated
using (
  active
  and starts_at <= now()
  and (ends_at is null or ends_at > now())
  and (
    public.has_staff_permission(auth.uid(),'admin:notifications')
    or audience='all'
    or (audience='specific_user' and target_user_id=auth.uid())
    or (audience='country' and exists (
      select 1 from public.profiles p
      where p.id=auth.uid() and upper(coalesce(p.country,''))=upper(coalesce(country_code,''))
    ))
    or (audience='artists' and exists (
      select 1 from public.profiles p where p.id=auth.uid() and p.account_type='artist'
    ))
    or (audience='labels' and exists (
      select 1 from public.profiles p where p.id=auth.uid() and p.account_type='label'
    ))
    or (audience='paid_artists'
        and public.nexo_user_has_paid_access(auth.uid())
        and exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_type='artist'))
    or (audience='free_artists'
        and not public.nexo_user_has_paid_access(auth.uid())
        and exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_type='artist'))
    or (audience='paid_labels'
        and public.nexo_user_has_paid_access(auth.uid())
        and exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_type='label'))
    or (audience='free_labels'
        and not public.nexo_user_has_paid_access(auth.uid())
        and exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_type='label'))
  )
);
