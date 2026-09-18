-- Make identity verification mandatory for every non-staff artist/label account.
-- Existing active portal accounts are moved back to pending_verification until
-- an administrator approves a verified identity submission.

create or replace function public.enforce_identity_verified_profile_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.account_status = 'active'
     and exists (
       select 1
       from public.user_roles ur
       where ur.user_id = new.id
         and ur.role in ('artist','label')
     )
     and not exists (
       select 1
       from public.user_roles ur
       where ur.user_id = new.id
         and ur.role in ('support','admin','super_admin')
     )
     and not exists (
       select 1
       from public.identity_verifications iv
       where iv.user_id = new.id
         and iv.status = 'verified'
     )
  then
    new.account_status := 'pending_verification';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_identity_verified_profile_status()
from public, anon, authenticated;

drop trigger if exists profiles_require_identity_verification on public.profiles;
create trigger profiles_require_identity_verification
  before insert or update of account_status on public.profiles
  for each row execute function public.enforce_identity_verified_profile_status();

create or replace function public.enforce_identity_status_on_portal_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role in ('artist','label')
     and not exists (
       select 1
       from public.user_roles ur
       where ur.user_id = new.user_id
         and ur.role in ('support','admin','super_admin')
     )
     and not exists (
       select 1
       from public.identity_verifications iv
       where iv.user_id = new.user_id
         and iv.status = 'verified'
     )
  then
    update public.profiles
    set account_status = 'pending_verification',
        updated_at = now()
    where id = new.user_id
      and account_status = 'active';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_identity_status_on_portal_role()
from public, anon, authenticated;

drop trigger if exists user_roles_require_identity_verification on public.user_roles;
create trigger user_roles_require_identity_verification
  after insert or update of role on public.user_roles
  for each row execute function public.enforce_identity_status_on_portal_role();

update public.profiles p
set account_status = 'pending_verification',
    updated_at = now()
where p.account_status = 'active'
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p.id
      and ur.role in ('artist','label')
  )
  and not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p.id
      and ur.role in ('support','admin','super_admin')
  )
  and not exists (
    select 1
    from public.identity_verifications iv
    where iv.user_id = p.id
      and iv.status = 'verified'
  );
