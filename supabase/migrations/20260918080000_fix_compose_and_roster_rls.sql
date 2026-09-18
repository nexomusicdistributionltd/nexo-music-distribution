-- NEXO — privileged server mutations for admin compose + atomic label roster creation
create or replace function public.admin_enqueue_composed_email(p_to_email text,p_template_key text,p_payload jsonb,p_related_entity_type text)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); eid uuid;
begin
 if uid is null or not public.is_admin_portal_staff(uid) then raise exception 'Administrator email permission required' using errcode='42501'; end if;
 insert into public.email_outbound_events(to_email,template_key,payload,status,related_entity_type)
 values(lower(btrim(p_to_email)),p_template_key,coalesce(p_payload,'{}'::jsonb),'queued',p_related_entity_type) returning id into eid;
 return eid;
end; $$;
revoke all on function public.admin_enqueue_composed_email(text,text,jsonb,text) from public;
grant execute on function public.admin_enqueue_composed_email(text,text,jsonb,text) to authenticated;

create or replace function public.create_label_roster_artist(p_stage_name text,p_bio text default null,p_country text default null,p_genres text[] default array[]::text[],p_avatar_url text default null,p_website text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); lid uuid; aid uuid;
begin
 if uid is null or not public.has_role(uid,'label') then raise exception 'Label role required' using errcode='42501'; end if;
 if btrim(coalesce(p_stage_name,''))='' then raise exception 'Stage / display name is required' using errcode='22023'; end if;
 select id into lid from public.label_profiles where user_id=uid limit 1;
 if lid is null then raise exception 'Label profile not found' using errcode='P0001'; end if;
 insert into public.artist_profiles(user_id,profile_id,stage_name,artist_name,bio,country,genres,avatar_url,website,created_by_label_profile_id)
 values(null,null,btrim(p_stage_name),btrim(p_stage_name),nullif(btrim(coalesce(p_bio,'')),''),nullif(btrim(coalesce(p_country,'')),''),coalesce(p_genres,array[]::text[]),nullif(btrim(coalesce(p_avatar_url,'')),''),nullif(btrim(coalesce(p_website,'')),''),lid) returning id into aid;
 insert into public.label_roster_artists(label_profile_id,artist_profile_id,created_by) values(lid,aid,uid);
 return aid;
end; $$;
revoke all on function public.create_label_roster_artist(text,text,text,text[],text,text) from public;
grant execute on function public.create_label_roster_artist(text,text,text,text[],text,text) to authenticated;
