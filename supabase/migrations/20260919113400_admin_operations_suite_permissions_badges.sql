drop policy if exists admin_ops_cases_staff on public.admin_ops_cases;
create policy admin_ops_cases_staff on public.admin_ops_cases
for all to authenticated
using (
  public.has_staff_permission(auth.uid(),'admin:operations')
  or (case_type in ('rights_claim','fraud_review','catalog_conflict','privacy_request') and public.has_staff_permission(auth.uid(),'admin:compliance'))
  or (case_type='security_review' and public.has_staff_permission(auth.uid(),'admin:users'))
  or (case_type='tax_compliance' and public.has_staff_permission(auth.uid(),'admin:finance'))
  or (case_type='email_deliverability' and public.has_staff_permission(auth.uid(),'admin:emails'))
)
with check (
  public.has_staff_permission(auth.uid(),'admin:operations')
  or (case_type in ('rights_claim','fraud_review','catalog_conflict','privacy_request') and public.has_staff_permission(auth.uid(),'admin:compliance'))
  or (case_type='security_review' and public.has_staff_permission(auth.uid(),'admin:users'))
  or (case_type='tax_compliance' and public.has_staff_permission(auth.uid(),'admin:finance'))
  or (case_type='email_deliverability' and public.has_staff_permission(auth.uid(),'admin:emails'))
);

drop policy if exists admin_ops_case_events_staff on public.admin_ops_case_events;
create policy admin_ops_case_events_staff on public.admin_ops_case_events
for all to authenticated
using (
  exists (
    select 1 from public.admin_ops_cases c
    where c.id=case_id and (
      public.has_staff_permission(auth.uid(),'admin:operations')
      or (c.case_type in ('rights_claim','fraud_review','catalog_conflict','privacy_request') and public.has_staff_permission(auth.uid(),'admin:compliance'))
      or (c.case_type='security_review' and public.has_staff_permission(auth.uid(),'admin:users'))
      or (c.case_type='tax_compliance' and public.has_staff_permission(auth.uid(),'admin:finance'))
      or (c.case_type='email_deliverability' and public.has_staff_permission(auth.uid(),'admin:emails'))
    )
  )
)
with check (
  exists (
    select 1 from public.admin_ops_cases c
    where c.id=case_id and (
      public.has_staff_permission(auth.uid(),'admin:operations')
      or (c.case_type in ('rights_claim','fraud_review','catalog_conflict','privacy_request') and public.has_staff_permission(auth.uid(),'admin:compliance'))
      or (c.case_type='security_review' and public.has_staff_permission(auth.uid(),'admin:users'))
      or (c.case_type='tax_compliance' and public.has_staff_permission(auth.uid(),'admin:finance'))
      or (c.case_type='email_deliverability' and public.has_staff_permission(auth.uid(),'admin:emails'))
    )
  )
);

drop policy if exists admin_ops_case_evidence_staff on public.admin_ops_case_evidence;
create policy admin_ops_case_evidence_staff on public.admin_ops_case_evidence
for all to authenticated
using (
  exists (
    select 1 from public.admin_ops_cases c
    where c.id=case_id and (
      public.has_staff_permission(auth.uid(),'admin:operations')
      or (c.case_type in ('rights_claim','fraud_review','catalog_conflict','privacy_request') and public.has_staff_permission(auth.uid(),'admin:compliance'))
      or (c.case_type='security_review' and public.has_staff_permission(auth.uid(),'admin:users'))
      or (c.case_type='tax_compliance' and public.has_staff_permission(auth.uid(),'admin:finance'))
      or (c.case_type='email_deliverability' and public.has_staff_permission(auth.uid(),'admin:emails'))
    )
  )
)
with check (
  exists (
    select 1 from public.admin_ops_cases c
    where c.id=case_id and (
      public.has_staff_permission(auth.uid(),'admin:operations')
      or (c.case_type in ('rights_claim','fraud_review','catalog_conflict','privacy_request') and public.has_staff_permission(auth.uid(),'admin:compliance'))
      or (c.case_type='security_review' and public.has_staff_permission(auth.uid(),'admin:users'))
      or (c.case_type='tax_compliance' and public.has_staff_permission(auth.uid(),'admin:finance'))
      or (c.case_type='email_deliverability' and public.has_staff_permission(auth.uid(),'admin:emails'))
    )
  )
);

create or replace function public.nexo_nav_badge_counts()
returns jsonb
language plpgsql
stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_is_staff boolean := false;
  v_routes jsonb := '{}'::jsonb;
  v_services jsonb := '{}'::jsonb;
  v_marketing_kinds text[] := array[
    'dsp_pitching','campaign','priority_pitch','spotify_discovery_mode',
    'promotional_assets','fan_blast','award_monitoring','third_party_playlisting',
    'ad_box','influencers','labs','luminate'
  ];
  v_ops_open integer := 0;
begin
  if v_uid is null then
    return jsonb_build_object('routes','{}'::jsonb,'services','{}'::jsonb);
  end if;

  v_is_staff :=
    public.has_role(v_uid, 'support'::public.app_role)
    or public.has_role(v_uid, 'admin'::public.app_role)
    or public.has_role(v_uid, 'super_admin'::public.app_role);

  if v_is_staff then
    select count(*) into v_ops_open from public.admin_ops_cases where status not in ('resolved','closed');

    v_routes := jsonb_build_object(
      '/admin/notifications',(select count(*) from public.notifications where user_id=v_uid and read_at is null),
      '/admin/support',(select count(*) from public.support_tickets where status::text in ('open','pending','awaiting_user')),
      '/admin/contact',(select count(*) from public.contact_messages where status::text in ('new','triaged')),
      '/admin/playlist-pitches',(select count(*) from public.playlist_pitch_requests where status in ('submitted','reviewing')),
      '/admin/marketing',(select count(*) from public.portal_service_requests where kind=any(v_marketing_kinds) and status in ('submitted','reviewing','needs_info','accepted','approved','processing','live')),
      '/admin/portal-requests',(
        (select count(*) from public.portal_service_requests where not (kind=any(v_marketing_kinds)) and status in ('submitted','reviewing','needs_info','accepted','approved','processing','live'))
        + (select count(*) from public.music_video_submissions where lower(coalesce(status,'')) not in ('completed','delivered','live','rejected','cancelled','failed'))
        + (select count(*) from public.payout_requests where lower(coalesce(status,'')) not in ('paid','completed','rejected','cancelled','failed'))
      ),
      '/admin/qc',(select count(*) from public.qc_queue_items where status in ('queued','claimed','in_review')),
      '/admin/verifications',(select count(*) from public.identity_verifications where status::text in ('submitted','under_review')),
      '/admin/distribution',(select count(*) from public.distribution_jobs where status::text in ('queued','failed','takedown_requested','reinstating')),
      '/admin/payouts',(select count(*) from public.payout_requests where lower(coalesce(status,'')) not in ('paid','completed','rejected','cancelled','failed')),
      '/admin/operations',v_ops_open,
      '/admin/rights',(select count(*) from public.admin_ops_cases where case_type='rights_claim' and status not in ('resolved','closed')),
      '/admin/fraud',(select count(*) from public.admin_ops_cases where case_type='fraud_review' and status not in ('resolved','closed')),
      '/admin/conflicts',(select count(*) from public.admin_ops_cases where case_type='catalog_conflict' and status not in ('resolved','closed')),
      '/admin/privacy',(select count(*) from public.admin_ops_cases where case_type='privacy_request' and status not in ('resolved','closed')),
      '/admin/security',(select count(*) from public.admin_ops_cases where case_type='security_review' and status not in ('resolved','closed')),
      '/admin/email-deliverability',(select count(*) from public.email_outbound_events where status::text='failed'),
      '/admin/tax-compliance',(
        (select count(*) from public.admin_ops_cases where case_type='tax_compliance' and status not in ('resolved','closed'))
        + (select count(*) from public.tax_compliance_profiles where hold_payouts or status in ('required','expired','blocked'))
      ),
      '/admin/approvals',(select count(*) from public.admin_high_risk_requests where status='pending'),
      '/admin/work-queue',(
        v_ops_open
        + (select count(*) from public.qc_queue_items where status in ('queued','claimed','in_review'))
        + (select count(*) from public.distribution_jobs where status::text in ('queued','failed','takedown_requested','reinstating'))
        + (select count(*) from public.identity_verifications where status::text in ('submitted','under_review'))
        + (select count(*) from public.support_tickets where status::text in ('open','pending','awaiting_user'))
        + (select count(*) from public.payout_requests where lower(coalesce(status,'')) not in ('paid','completed','rejected','cancelled','failed'))
        + (select count(*) from public.email_outbound_events where status::text='failed')
      ),
      '/admin/distribution/stores',(select count(*) from public.distribution_store_capabilities where operational_status in ('limited','approval_required','disabled')),
      '/admin/contracts',(select count(*) from public.admin_policy_versions where status='draft')
    );

    select coalesce(jsonb_object_agg(kind,cnt),'{}'::jsonb)
      into v_services
    from (
      select kind,count(*)::int as cnt
      from public.portal_service_requests
      where status in ('submitted','reviewing','needs_info','accepted','approved','processing','live')
      group by kind
    ) q;
  else
    v_routes := jsonb_build_object(
      '/dashboard/notifications',(select count(*) from public.notifications where user_id=v_uid and read_at is null),
      '/support',(select count(*) from public.support_tickets where requester_user_id=v_uid and status::text in ('open','pending','awaiting_user')),
      '/dashboard/playlist-pitch',(select count(*) from public.playlist_pitch_requests where owner_user_id=v_uid and status in ('submitted','reviewing','rejected')),
      '/dashboard/releases',(select count(*) from public.releases where owner_user_id=v_uid and status='changes_requested'::public.release_status),
      '/dashboard/videos',(select count(*) from public.music_video_submissions where owner_user_id=v_uid and lower(coalesce(status,'')) not in ('completed','delivered','live','rejected','cancelled','failed')),
      '/earnings/payouts',(select count(*) from public.payout_requests where owner_user_id=v_uid and lower(coalesce(status,'')) not in ('paid','completed','rejected','cancelled','failed'))
    );

    select coalesce(jsonb_object_agg(kind,cnt),'{}'::jsonb)
      into v_services
    from (
      select kind,count(*)::int as cnt
      from public.portal_service_requests
      where owner_user_id=v_uid
        and status in ('submitted','reviewing','needs_info','accepted','approved','processing','live')
      group by kind
    ) q;
  end if;

  return jsonb_build_object('routes',v_routes,'services',v_services);
end;
$$;
