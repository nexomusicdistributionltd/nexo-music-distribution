
create or replace function public.create_payout_request_with_method(
  p_owner_user_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_payout_method_id uuid,
  p_idempotency_key text default null
)
returns public.payouts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_method public.payout_methods;
  v_created public.payouts;
  v_currency text := upper(btrim(coalesce(p_currency,'')));
  v_mask text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select *
    into v_method
  from public.payout_methods
  where id = p_payout_method_id
    and user_id = p_owner_user_id
    and status = 'active'
  for share;

  if not found then
    raise exception 'An active approved payout method is required' using errcode='22023';
  end if;

  if length(v_currency) <> 3 then
    raise exception 'ISO currency required' using errcode='22023';
  end if;

  if v_method.currency is not null
     and upper(btrim(v_method.currency::text)) <> v_currency then
    raise exception 'Payout method currency does not match payout currency' using errcode='22023';
  end if;

  v_created := public.create_payout_request(
    p_owner_user_id,
    p_amount_minor,
    v_currency::char(3),
    v_method.method_type || ': ' || v_method.display_name,
    p_idempotency_key
  );

  v_mask := coalesce(
    nullif(v_method.details->>'destination_mask',''),
    v_method.display_name
  );

  update public.payouts
  set payout_method_id = v_method.id,
      destination_mask = v_mask,
      updated_at = now()
  where id = v_created.id
  returning * into v_created;

  return v_created;
end;
$$;

revoke all on function public.create_payout_request_with_method(uuid,bigint,text,uuid,text)
from public, anon;
grant execute on function public.create_payout_request_with_method(uuid,bigint,text,uuid,text)
to authenticated, service_role;
