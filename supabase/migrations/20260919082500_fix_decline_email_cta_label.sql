-- General release corrections must not use the audio-specific CTA.
do $$
declare
  v_def text;
  v_old text := '''CTA_LABEL'', ''Replace audio & resubmit''';
  v_new text := '''CTA_LABEL'', case when v_is_flac then ''Replace audio & resubmit'' else ''Update release & resubmit'' end';
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_reopen_release_for_corrections'
  limit 1;

  if v_def is null then
    raise exception 'admin_reopen_release_for_corrections not found';
  end if;

  if position(v_old in v_def) = 0 then
    raise exception 'Expected CTA label fragment not found';
  end if;

  execute replace(v_def, v_old, v_new);
end
$$;
