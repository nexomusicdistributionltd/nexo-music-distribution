
create or replace function public.publish_notification_broadcast(
  p_title text,
  p_body text,
  p_audience text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  v_id uuid;
  v_count integer := 0;
  v_title text := btrim(coalesce(p_title,''));
  v_body text := btrim(coalesce(p_body,''));
  v_audience text := lower(btrim(coalesce(p_audience,'all')));
begin
  if actor is null or not public.is_admin_portal_staff(actor) then
    raise exception 'Administrator permission required' using errcode='42501';
  end if;
  if char_length(v_title) < 2 or char_length(v_title) > 160 then
    raise exception 'Title must be 2-160 characters' using errcode='22023';
  end if;
  if char_length(v_body) < 2 or char_length(v_body) > 20000 then
    raise exception 'Body must be 2-20000 characters' using errcode='22023';
  end if;
  if v_audience not in ('all','artists','labels') then
    raise exception 'Invalid broadcast audience' using errcode='22023';
  end if;

  insert into public.notification_broadcasts(title,body,audience,created_by)
  values(v_title,v_body,v_audience,actor)
  returning id into v_id;

  insert into public.notifications(user_id,type,title,body,entity_type,entity_id)
  select p.id,'broadcast'::public.notification_type,v_title,v_body,'notification_broadcast',v_id
  from public.profiles p
  where p.account_type in ('artist','label')
    and p.account_status in ('active','pending_verification')
    and (
      v_audience='all'
      or (v_audience='artists' and p.account_type='artist')
      or (v_audience='labels' and p.account_type='label')
    );

  get diagnostics v_count = row_count;

  update public.notification_broadcasts
  set recipient_count=v_count, published_at=now()
  where id=v_id;

  return jsonb_build_object('id',v_id,'recipient_count',v_count);
end;
$$;

revoke all on function public.publish_notification_broadcast(text,text,text)
from public, anon;
grant execute on function public.publish_notification_broadcast(text,text,text)
to authenticated, service_role;

revoke all on function public.has_current_distribution_agreement(uuid)
from public, anon;
grant execute on function public.has_current_distribution_agreement(uuid)
to authenticated, service_role;

revoke all on function public.enforce_distribution_agreement_on_release()
from public, anon, authenticated;
grant execute on function public.enforce_distribution_agreement_on_release()
to service_role;

revoke all on function public.touch_payout_methods_updated_at()
from public, anon, authenticated;
grant execute on function public.touch_payout_methods_updated_at()
to service_role;
