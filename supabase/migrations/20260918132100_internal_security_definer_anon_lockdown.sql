-- Remove anonymous EXECUTE from internal SECURITY DEFINER functions.
-- Keep the intentional public contact/newsletter RPCs and RLS helper functions unchanged.

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and p.proname = any(array[
        '_email_release_owner',
        'account_action_timeline',
        'assert_account_may_mutate',
        'audit_report_export_insert',
        'bump_health_counter',
        'email_automation_allows',
        'enforce_release_child_editability',
        'enqueue_distribution_email',
        'enqueue_email_event',
        'enqueue_email_on_contact_message',
        'enqueue_email_on_release_status',
        'enqueue_email_on_support_reply',
        'enqueue_email_on_support_ticket',
        'ensure_qc_queue_item',
        'handle_new_user',
        'handle_user_email_confirmed',
        'mark_email_event_status',
        'prevent_profile_privilege_escalation',
        'process_payout_webhook_event',
        'process_provider_webhook_event',
        'protect_notification_fields',
        'protect_payout_row',
        'protect_publishing_collection_claims',
        'protect_release_privileged_fields',
        'protect_split_rule_history',
        'protect_split_shares_history',
        'record_job_run',
        'rls_auto_enable',
        'validate_publishing_shares',
        'validate_split_rule_shares'
      ]::text[])
  loop
    execute format('revoke execute on function %s from public, anon', r.fn);
  end loop;
end $$;
