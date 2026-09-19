-- Actionable count badges for admin, artist, and label navigation.
-- Counts only; no row contents are exposed.

create or replace function public.nexo_nav_badge_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_is_staff boolean := false;
  v_routes jsonb := '{}'::jsonb;
  v_services jsonb := '{}'::jsonb;
  v_marketing_kinds text[] := array[
    'dsp_pitching',
    'campaign',
    'priority_pitch',
    'spotify_discovery_mode',
    'promotional_assets',
    'fan_blast',
    'award_monitoring',
    'third_party_playlisting',
    'ad_box',
    'influencers',
    'labs',
    'luminate'
  ];
begin
  if v_uid is null then
    return jsonb_build_object('routes','{}'::jsonb,'services','{}'::jsonb);
  end if;

  v_is_staff :=
    public.has_role(v_uid, 'support'::public.app_role)
    or public.has_role(v_uid, 'admin'::public.app_role)
    or public.has_role(v_uid, 'super_admin'::public.app_role);

  if v_is_staff then
    v_routes := jsonb_build_object(
      '/admin/notifications',
        (select count(*) from public.notifications
         where user_id = v_uid and read_at is null),

      '/admin/support',
        (select count(*) from public.support_tickets
         where status::text in ('open','pending','awaiting_user')),

      '/admin/contact',
        (select count(*) from public.contact_messages
         where status::text in ('new','triaged')),

      '/admin/playlist-pitches',
        (select count(*) from public.playlist_pitch_requests
         where status in ('submitted','reviewing')),

      '/admin/marketing',
        (select count(*) from public.portal_service_requests
         where kind = any(v_marketing_kinds)
           and status in ('submitted','reviewing','needs_info','accepted','approved','processing','live')),

      '/admin/portal-requests',
        (
          (select count(*) from public.portal_service_requests
           where not (kind = any(v_marketing_kinds))
             and status in ('submitted','reviewing','needs_info','accepted','approved','processing','live'))
          +
          (select count(*) from public.music_video_submissions
           where lower(coalesce(status,'')) not in ('completed','delivered','live','rejected','cancelled','failed'))
          +
          (select count(*) from public.payout_requests
           where lower(coalesce(status,'')) not in ('paid','completed','rejected','cancelled','failed'))
        ),

      '/admin/qc',
        (select count(*) from public.qc_queue_items
         where status in ('queued','claimed','in_review')),

      '/admin/verifications',
        (select count(*) from public.identity_verifications
         where status::text in ('submitted','under_review')),

      '/admin/distribution',
        (select count(*) from public.distribution_jobs
         where status::text in ('queued','failed','takedown_requested','reinstating')),

      '/admin/payouts',
        (select count(*) from public.payout_requests
         where lower(coalesce(status,'')) not in ('paid','completed','rejected','cancelled','failed'))
    );

    select coalesce(jsonb_object_agg(kind, cnt), '{}'::jsonb)
      into v_services
    from (
      select kind, count(*)::int as cnt
      from public.portal_service_requests
      where status in ('submitted','reviewing','needs_info','accepted','approved','processing','live')
      group by kind
    ) q;
  else
    v_routes := jsonb_build_object(
      '/dashboard/notifications',
        (select count(*) from public.notifications
         where user_id = v_uid and read_at is null),

      '/support',
        (select count(*) from public.support_tickets
         where requester_user_id = v_uid
           and status::text in ('open','pending','awaiting_user')),

      '/dashboard/playlist-pitch',
        (select count(*) from public.playlist_pitch_requests
         where owner_user_id = v_uid
           and status in ('submitted','reviewing','rejected')),

      '/dashboard/releases',
        (select count(*) from public.releases
         where owner_user_id = v_uid
           and status = 'changes_requested'::public.release_status),

      '/dashboard/videos',
        (select count(*) from public.music_video_submissions
         where owner_user_id = v_uid
           and lower(coalesce(status,'')) not in ('completed','delivered','live','rejected','cancelled','failed')),

      '/earnings/payouts',
        (select count(*) from public.payout_requests
         where owner_user_id = v_uid
           and lower(coalesce(status,'')) not in ('paid','completed','rejected','cancelled','failed'))
    );

    select coalesce(jsonb_object_agg(kind, cnt), '{}'::jsonb)
      into v_services
    from (
      select kind, count(*)::int as cnt
      from public.portal_service_requests
      where owner_user_id = v_uid
        and status in ('submitted','reviewing','needs_info','accepted','approved','processing','live')
      group by kind
    ) q;
  end if;

  return jsonb_build_object(
    'routes', v_routes,
    'services', v_services
  );
end;
$$;

revoke all on function public.nexo_nav_badge_counts() from public;
revoke all on function public.nexo_nav_badge_counts() from anon;
grant execute on function public.nexo_nav_badge_counts() to authenticated;

comment on function public.nexo_nav_badge_counts() is
  'Returns small actionable-count maps for workspace navigation badges. It exposes counts only, never row content.';
