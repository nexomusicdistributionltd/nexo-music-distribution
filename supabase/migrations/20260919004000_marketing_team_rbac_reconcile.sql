-- Reconcile the realtime Marketing control center with functional staff RBAC.
-- Runs after 20260919001000_realtime_marketing_control.sql.

create or replace function public.guard_marketing_request_admin_update()
returns trigger
language plpgsql
set search_path=public
as $marketing_rbac$
begin
  if auth.uid() is null then
    return new;
  end if;

  if old.kind in ('dsp_pitching','campaign','priority_pitch','spotify_discovery_mode','promotional_assets','fan_blast','award_monitoring','third_party_playlisting','ad_box','influencers','labs','luminate') then
    if public.has_staff_permission(auth.uid(),'admin:marketing') then
      return new;
    end if;

    if (
      old.owner_user_id=auth.uid()
      and old.status in ('needs_info','rejected')
      and new.status='submitted'
      and new.owner_user_id is not distinct from old.owner_user_id
      and new.kind is not distinct from old.kind
      and new.title is not distinct from old.title
      and new.release_id is not distinct from old.release_id
      and new.track_id is not distinct from old.track_id
      and new.priority is not distinct from old.priority
      and new.assigned_to is not distinct from old.assigned_to
      and new.provider_state is not distinct from old.provider_state
      and new.provider_reference is not distinct from old.provider_reference
      and new.provider_url is not distinct from old.provider_url
      and new.provider_response is not distinct from old.provider_response
      and new.submitted_payload is not distinct from old.submitted_payload
      and new.completed_at is not distinct from old.completed_at
    ) then
      return new;
    end if;

    raise exception 'Marketing request updates require Marketing permission'
      using errcode='42501';
  end if;

  return new;
end;
$marketing_rbac$;

drop policy if exists "portal_service_select" on public.portal_service_requests;
create policy "portal_service_select" on public.portal_service_requests
  for select to authenticated
  using (
    owner_user_id=auth.uid()
    or (
      kind in ('dsp_pitching','campaign','priority_pitch','spotify_discovery_mode','promotional_assets','fan_blast','award_monitoring','third_party_playlisting','ad_box','influencers','labs','luminate')
      and public.has_staff_permission(auth.uid(),'admin:marketing')
    )
    or (
      kind not in ('dsp_pitching','campaign','priority_pitch','spotify_discovery_mode','promotional_assets','fan_blast','award_monitoring','third_party_playlisting','ad_box','influencers','labs','luminate')
      and public.has_staff_permission(auth.uid(),'admin:support')
    )
  );

drop policy if exists "portal_service_staff_update" on public.portal_service_requests;
create policy "portal_service_staff_update" on public.portal_service_requests
  for update to authenticated
  using (
    (
      kind in ('dsp_pitching','campaign','priority_pitch','spotify_discovery_mode','promotional_assets','fan_blast','award_monitoring','third_party_playlisting','ad_box','influencers','labs','luminate')
      and public.has_staff_permission(auth.uid(),'admin:marketing')
    )
    or (
      kind not in ('dsp_pitching','campaign','priority_pitch','spotify_discovery_mode','promotional_assets','fan_blast','award_monitoring','third_party_playlisting','ad_box','influencers','labs','luminate')
      and public.has_staff_permission(auth.uid(),'admin:support')
    )
  )
  with check (
    (
      kind in ('dsp_pitching','campaign','priority_pitch','spotify_discovery_mode','promotional_assets','fan_blast','award_monitoring','third_party_playlisting','ad_box','influencers','labs','luminate')
      and public.has_staff_permission(auth.uid(),'admin:marketing')
    )
    or (
      kind not in ('dsp_pitching','campaign','priority_pitch','spotify_discovery_mode','promotional_assets','fan_blast','award_monitoring','third_party_playlisting','ad_box','influencers','labs','luminate')
      and public.has_staff_permission(auth.uid(),'admin:support')
    )
  );

drop policy if exists "marketing_service_controls_staff_write"
  on public.marketing_service_controls;
create policy "marketing_service_controls_staff_write"
  on public.marketing_service_controls
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:marketing'))
  with check (public.has_staff_permission(auth.uid(),'admin:marketing'));

drop policy if exists "marketing_content_pages_staff_write"
  on public.marketing_content_pages;
create policy "marketing_content_pages_staff_write"
  on public.marketing_content_pages
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:marketing'))
  with check (public.has_staff_permission(auth.uid(),'admin:marketing'));
