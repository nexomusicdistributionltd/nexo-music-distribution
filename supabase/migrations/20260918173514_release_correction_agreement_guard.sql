-- Allow legacy releases to move backward into correction states even when
-- the current distribution agreement was not yet signed. Forward distribution
-- remains agreement-gated.

create or replace function public.enforce_distribution_agreement_on_release()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.owner_user_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.status is distinct from new.status
     and new.status in ('draft', 'changes_requested', 'rejected') then
    return new;
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id=new.owner_user_id
      and ur.role in ('artist','label')
  ) and not public.has_current_distribution_agreement(new.owner_user_id) then
    raise exception
      'Current Nexo distribution agreement must be signed before creating or distributing releases'
      using errcode='42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_distribution_agreement_on_release()
from public, anon, authenticated;
grant execute on function public.enforce_distribution_agreement_on_release()
to service_role;
