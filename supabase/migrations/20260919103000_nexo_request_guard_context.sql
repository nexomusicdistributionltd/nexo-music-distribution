-- Consolidate the current-user guard data used by every Server Action into a
-- single authenticated RPC. This preserves the existing security checks while
-- removing several serial profile/role/OTP/identity database roundtrips.

create or replace function public.nexo_request_guard_context()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (
    select auth.uid() as uid
  ),
  roles as (
    select coalesce(
      jsonb_agg(ur.role order by ur.role::text)
        filter (where ur.role is not null),
      '[]'::jsonb
    ) as value
    from public.user_roles ur
    join me on me.uid = ur.user_id
  )
  select jsonb_build_object(
    'profile',
      coalesce(
        (
          select to_jsonb(p)
          from public.profiles p
          join me on me.uid = p.id
          limit 1
        ),
        'null'::jsonb
      ),
    'roles',
      (select value from roles),
    'otp_verified',
      case
        when (select uid from me) is null then false
        else public.nexo_login_otp_verified()
      end,
    'identity_status',
      (
        select iv.status::text
        from public.identity_verifications iv
        join me on me.uid = iv.user_id
        limit 1
      )
  );
$$;

revoke all on function public.nexo_request_guard_context() from public;
revoke all on function public.nexo_request_guard_context() from anon;
grant execute on function public.nexo_request_guard_context() to authenticated;

comment on function public.nexo_request_guard_context() is
  'Returns the current authenticated user profile, roles, OTP verification state, and identity verification state in one DB roundtrip for request guards.';
