-- NEXO — Administrator / staff RBAC hardening
-- Support remains a real staff role for QC/support operations, but sensitive
-- finance, provider, DDEX, compliance, email and CMS access is administrator-only.

create or replace function public.is_administrator(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select uid is not null and (
    public.has_role(uid, 'admin')
    or public.has_role(uid, 'super_admin')
  );
$$;

revoke all on function public.is_administrator(uuid) from public;
grant execute on function public.is_administrator(uuid) to authenticated, service_role;

-- Audit logs: Support can create/read only through its permitted operations,
-- but the global audit viewer is administrator-only.
drop policy if exists "audit_logs_select_staff" on public.audit_logs;
create policy "audit_logs_select_staff" on public.audit_logs
  for select to authenticated
  using (public.is_administrator(auth.uid()));

-- Account lifecycle history is administrator-only.
drop policy if exists "account_actions_staff" on public.account_actions;
create policy "account_actions_staff" on public.account_actions
  for select to authenticated
  using (public.is_administrator(auth.uid()));

-- Finance / royalties / payouts
drop policy if exists "ledger_accounts_select" on public.ledger_accounts;
create policy "ledger_accounts_select" on public.ledger_accounts
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_administrator(auth.uid()));

drop policy if exists "ledger_entries_select" on public.ledger_entries;
create policy "ledger_entries_select" on public.ledger_entries
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_administrator(auth.uid()));

drop policy if exists "royalty_statements_select" on public.royalty_statements;
create policy "royalty_statements_select" on public.royalty_statements
  for select to authenticated
  using ((owner_user_id = auth.uid() and status = 'published') or public.is_administrator(auth.uid()));

drop policy if exists "royalty_line_items_select" on public.royalty_line_items;
create policy "royalty_line_items_select" on public.royalty_line_items
  for select to authenticated
  using (
    exists (
      select 1 from public.royalty_statements s
      where s.id = statement_id
        and ((s.owner_user_id = auth.uid() and s.status = 'published') or public.is_administrator(auth.uid()))
    )
  );

drop policy if exists "payouts_select" on public.payouts;
create policy "payouts_select" on public.payouts
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_administrator(auth.uid()));

drop policy if exists "payout_adjustments_select" on public.payout_adjustments;
create policy "payout_adjustments_select" on public.payout_adjustments
  for select to authenticated
  using (
    public.is_administrator(auth.uid())
    or exists (select 1 from public.payouts p where p.id = payout_id and p.owner_user_id = auth.uid())
  );

drop policy if exists "royalty_import_batches_staff" on public.royalty_import_batches;
create policy "royalty_import_batches_staff" on public.royalty_import_batches
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

drop policy if exists "royalty_import_rows_staff" on public.royalty_import_rows;
create policy "royalty_import_rows_staff" on public.royalty_import_rows
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

drop policy if exists "royalty_split_rules_select" on public.royalty_split_rules;
create policy "royalty_split_rules_select" on public.royalty_split_rules
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_administrator(auth.uid()));

drop policy if exists "royalty_split_rules_owner_write" on public.royalty_split_rules;
create policy "royalty_split_rules_owner_write" on public.royalty_split_rules
  for insert to authenticated
  with check (owner_user_id = auth.uid() or public.is_administrator(auth.uid()));

drop policy if exists "royalty_split_rules_owner_update" on public.royalty_split_rules;
create policy "royalty_split_rules_owner_update" on public.royalty_split_rules
  for update to authenticated
  using (owner_user_id = auth.uid() or public.is_administrator(auth.uid()))
  with check (owner_user_id = auth.uid() or public.is_administrator(auth.uid()));

drop policy if exists "royalty_split_shares_select" on public.royalty_split_shares;
create policy "royalty_split_shares_select" on public.royalty_split_shares
  for select to authenticated
  using (
    public.is_administrator(auth.uid())
    or exists (
      select 1 from public.royalty_split_rules r
      where r.id = rule_id and (r.owner_user_id = auth.uid() or party_user_id = auth.uid())
    )
  );

drop policy if exists "royalty_split_shares_write" on public.royalty_split_shares;
create policy "royalty_split_shares_write" on public.royalty_split_shares
  for all to authenticated
  using (
    public.is_administrator(auth.uid())
    or exists (select 1 from public.royalty_split_rules r where r.id = rule_id and r.owner_user_id = auth.uid())
  )
  with check (
    public.is_administrator(auth.uid())
    or exists (select 1 from public.royalty_split_rules r where r.id = rule_id and r.owner_user_id = auth.uid())
  );

drop policy if exists "fx_rates_staff_write" on public.fx_rates;
create policy "fx_rates_staff_write" on public.fx_rates
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

drop policy if exists "payout_webhook_events_staff" on public.payout_webhook_events;
create policy "payout_webhook_events_staff" on public.payout_webhook_events
  for select to authenticated
  using (public.is_administrator(auth.uid()));

drop policy if exists "payout_compliance_holds_select" on public.payout_compliance_holds;
create policy "payout_compliance_holds_select" on public.payout_compliance_holds
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_administrator(auth.uid()));

drop policy if exists "payout_compliance_holds_staff" on public.payout_compliance_holds;
create policy "payout_compliance_holds_staff" on public.payout_compliance_holds
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

-- Publishing: owners retain their own access; administrator branch no longer includes Support.
drop policy if exists "publishing_works_select" on public.publishing_works;
create policy "publishing_works_select" on public.publishing_works
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_administrator(auth.uid()));
drop policy if exists "publishing_works_write" on public.publishing_works;
create policy "publishing_works_write" on public.publishing_works
  for all to authenticated
  using (owner_user_id = auth.uid() or public.is_administrator(auth.uid()))
  with check (owner_user_id = auth.uid() or public.is_administrator(auth.uid()));

drop policy if exists "publishing_parties_select" on public.publishing_parties;
create policy "publishing_parties_select" on public.publishing_parties
  for select to authenticated
  using (owner_user_id = auth.uid() or owner_user_id is null or public.is_administrator(auth.uid()));
drop policy if exists "publishing_parties_write" on public.publishing_parties;
create policy "publishing_parties_write" on public.publishing_parties
  for all to authenticated
  using (owner_user_id = auth.uid() or public.is_administrator(auth.uid()))
  with check (owner_user_id = auth.uid() or public.is_administrator(auth.uid()));

drop policy if exists "publishing_shares_select" on public.publishing_shares;
create policy "publishing_shares_select" on public.publishing_shares
  for select to authenticated
  using (
    public.is_administrator(auth.uid())
    or exists (select 1 from public.publishing_works w where w.id = work_id and w.owner_user_id = auth.uid())
  );
drop policy if exists "publishing_shares_write" on public.publishing_shares;
create policy "publishing_shares_write" on public.publishing_shares
  for all to authenticated
  using (
    public.is_administrator(auth.uid())
    or exists (select 1 from public.publishing_works w where w.id = work_id and w.owner_user_id = auth.uid())
  )
  with check (
    public.is_administrator(auth.uid())
    or exists (select 1 from public.publishing_works w where w.id = work_id and w.owner_user_id = auth.uid())
  );

drop policy if exists "publishing_work_recordings_select" on public.publishing_work_recordings;
create policy "publishing_work_recordings_select" on public.publishing_work_recordings
  for select to authenticated
  using (
    public.is_administrator(auth.uid())
    or exists (select 1 from public.publishing_works w where w.id = work_id and w.owner_user_id = auth.uid())
  );
drop policy if exists "publishing_work_recordings_write" on public.publishing_work_recordings;
create policy "publishing_work_recordings_write" on public.publishing_work_recordings
  for all to authenticated
  using (
    public.is_administrator(auth.uid())
    or exists (select 1 from public.publishing_works w where w.id = work_id and w.owner_user_id = auth.uid())
  )
  with check (
    public.is_administrator(auth.uid())
    or exists (select 1 from public.publishing_works w where w.id = work_id and w.owner_user_id = auth.uid())
  );

drop policy if exists "publishing_collection_claims_select" on public.publishing_collection_claims;
create policy "publishing_collection_claims_select" on public.publishing_collection_claims
  for select to authenticated
  using (
    public.is_administrator(auth.uid())
    or exists (select 1 from public.publishing_works w where w.id = work_id and w.owner_user_id = auth.uid())
  );
drop policy if exists "publishing_collection_claims_staff_write" on public.publishing_collection_claims;
create policy "publishing_collection_claims_staff_write" on public.publishing_collection_claims
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

-- Compliance / identity verification
drop policy if exists "compliance_cases_staff" on public.compliance_cases;
create policy "compliance_cases_staff" on public.compliance_cases
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

drop policy if exists "compliance_evidence_staff" on public.compliance_evidence;
create policy "compliance_evidence_staff" on public.compliance_evidence
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

drop policy if exists "compliance_evidence_staff" on storage.objects;
create policy "compliance_evidence_staff" on storage.objects
  for all to authenticated
  using (bucket_id = 'compliance-evidence' and public.is_administrator(auth.uid()))
  with check (bucket_id = 'compliance-evidence' and public.is_administrator(auth.uid()));

drop policy if exists "identity_verifications_select_own_or_staff" on public.identity_verifications;
create policy "identity_verifications_select_own_or_staff" on public.identity_verifications
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_administrator((select auth.uid())));

drop policy if exists "identity_submissions_select_own_or_staff" on public.identity_verification_submissions;
create policy "identity_submissions_select_own_or_staff" on public.identity_verification_submissions
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_administrator((select auth.uid())));

drop policy if exists "identity_events_select_own_or_staff" on public.identity_verification_events;
create policy "identity_events_select_own_or_staff" on public.identity_verification_events
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or public.is_administrator((select auth.uid()))
    or exists (
      select 1 from public.identity_verifications v
      where v.id = verification_id and v.user_id = (select auth.uid())
    )
  );

drop policy if exists "identity_storage_select_own_or_staff" on storage.objects;
create policy "identity_storage_select_own_or_staff" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'identity-verification'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_administrator((select auth.uid()))
    )
  );

drop policy if exists "identity_risk_staff_read" on public.identity_verification_risk_signals;
create policy "identity_risk_staff_read" on public.identity_verification_risk_signals
  for select to authenticated
  using (public.is_administrator((select auth.uid())));

-- TooLost / Distribution Engine operational records.
drop policy if exists "distribution_jobs_select" on public.distribution_jobs;
create policy "distribution_jobs_select" on public.distribution_jobs
  for select to authenticated
  using (public.is_administrator(auth.uid()) or public.owns_release(release_id));

drop policy if exists "provider_submissions_select" on public.provider_submissions;
create policy "provider_submissions_select" on public.provider_submissions
  for select to authenticated
  using (public.is_administrator(auth.uid()) or public.owns_release(release_id));

drop policy if exists "provider_webhook_events_staff_select" on public.provider_webhook_events;
create policy "provider_webhook_events_staff_select" on public.provider_webhook_events
  for select to authenticated
  using (public.is_administrator(auth.uid()));

drop policy if exists "provider_sync_runs_select" on public.provider_sync_runs;
create policy "provider_sync_runs_select" on public.provider_sync_runs
  for select to authenticated
  using (
    public.is_administrator(auth.uid())
    or (release_id is not null and public.owns_release(release_id))
  );

drop policy if exists "distribution_retries_select" on public.distribution_retries;
create policy "distribution_retries_select" on public.distribution_retries
  for select to authenticated
  using (public.is_administrator(auth.uid()) or public.owns_release(release_id));

-- Catalog migration / DSP mapping: owners keep their own Move-In workflow;
-- the privileged staff branch is administrator-only.
drop policy if exists "catalog_migrations_select" on public.catalog_migrations;
create policy "catalog_migrations_select" on public.catalog_migrations
  for select to authenticated
  using (public.is_administrator(auth.uid()) or owner_user_id = auth.uid());
drop policy if exists "catalog_migrations_staff_insert" on public.catalog_migrations;
create policy "catalog_migrations_staff_insert" on public.catalog_migrations
  for insert to authenticated with check (public.is_administrator(auth.uid()));
drop policy if exists "catalog_migrations_staff_update" on public.catalog_migrations;
create policy "catalog_migrations_staff_update" on public.catalog_migrations
  for update to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

drop policy if exists "catalog_migration_items_select" on public.catalog_migration_items;
create policy "catalog_migration_items_select" on public.catalog_migration_items
  for select to authenticated
  using (
    public.is_administrator(auth.uid())
    or exists (
      select 1 from public.catalog_migrations m
      where m.id = migration_id and m.owner_user_id = auth.uid()
    )
  );
drop policy if exists "catalog_migration_items_staff_write" on public.catalog_migration_items;
create policy "catalog_migration_items_staff_write" on public.catalog_migration_items
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

drop policy if exists "catalog_migration_conflicts_select" on public.catalog_migration_conflicts;
create policy "catalog_migration_conflicts_select" on public.catalog_migration_conflicts
  for select to authenticated
  using (
    public.is_administrator(auth.uid())
    or exists (
      select 1 from public.catalog_migrations m
      where m.id = migration_id and m.owner_user_id = auth.uid()
    )
  );
drop policy if exists "catalog_migration_conflicts_staff_write" on public.catalog_migration_conflicts;
create policy "catalog_migration_conflicts_staff_write" on public.catalog_migration_conflicts
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

drop policy if exists "artist_dsp_mappings_select" on public.artist_dsp_mappings;
create policy "artist_dsp_mappings_select" on public.artist_dsp_mappings
  for select to authenticated
  using (
    public.is_administrator(auth.uid())
    or exists (
      select 1 from public.artist_profiles ap
      where ap.id = artist_profile_id and ap.user_id = auth.uid()
    )
  );
drop policy if exists "artist_dsp_mappings_staff_write" on public.artist_dsp_mappings;
create policy "artist_dsp_mappings_staff_write" on public.artist_dsp_mappings
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

drop policy if exists "catalog_migrations_owner_insert" on public.catalog_migrations;
create policy "catalog_migrations_owner_insert" on public.catalog_migrations
  for insert to authenticated
  with check (owner_user_id = auth.uid() or public.is_administrator(auth.uid()));
drop policy if exists "catalog_migrations_owner_update" on public.catalog_migrations;
create policy "catalog_migrations_owner_update" on public.catalog_migrations
  for update to authenticated
  using (owner_user_id = auth.uid() or public.is_administrator(auth.uid()))
  with check (owner_user_id = auth.uid() or public.is_administrator(auth.uid()));
drop policy if exists "catalog_migration_items_owner_write" on public.catalog_migration_items;
create policy "catalog_migration_items_owner_write" on public.catalog_migration_items
  for all to authenticated
  using (
    public.is_administrator(auth.uid())
    or exists (
      select 1 from public.catalog_migrations m
      where m.id = migration_id and m.owner_user_id = auth.uid()
    )
  )
  with check (
    public.is_administrator(auth.uid())
    or exists (
      select 1 from public.catalog_migrations m
      where m.id = migration_id and m.owner_user_id = auth.uid()
    )
  );

-- Billing / payout method / agreement administration.
drop policy if exists "billing_customers_select_own" on public.billing_customers;
create policy "billing_customers_select_own" on public.billing_customers
  for select to authenticated
  using (user_id = auth.uid() or public.is_administrator(auth.uid()));
drop policy if exists "billing_subscriptions_select_own" on public.billing_subscriptions;
create policy "billing_subscriptions_select_own" on public.billing_subscriptions
  for select to authenticated
  using (user_id = auth.uid() or public.is_administrator(auth.uid()));
drop policy if exists "billing_transactions_select_own" on public.billing_transactions;
create policy "billing_transactions_select_own" on public.billing_transactions
  for select to authenticated
  using (user_id = auth.uid() or public.is_administrator(auth.uid()));
drop policy if exists "billing_webhook_events_staff_select" on public.billing_webhook_events;
create policy "billing_webhook_events_staff_select" on public.billing_webhook_events
  for select to authenticated using (public.is_administrator(auth.uid()));
drop policy if exists "billing_checkout_intents_staff_select" on public.billing_checkout_intents;
create policy "billing_checkout_intents_staff_select" on public.billing_checkout_intents
  for select to authenticated using (public.is_administrator(auth.uid()));

drop policy if exists "agreement_company_staff_select" on public.distribution_agreement_company_authorizations;
create policy "agreement_company_staff_select" on public.distribution_agreement_company_authorizations
  for select to authenticated using (public.is_administrator(auth.uid()));
drop policy if exists "agreement_execution_owner_staff_select" on public.distribution_agreement_executions;
create policy "agreement_execution_owner_staff_select" on public.distribution_agreement_executions
  for select to authenticated
  using (user_id = auth.uid() or public.is_administrator(auth.uid()));
drop policy if exists "payout_methods_owner_staff_select" on public.payout_methods;
create policy "payout_methods_owner_staff_select" on public.payout_methods
  for select to authenticated
  using (user_id = auth.uid() or public.is_administrator(auth.uid()));

-- Email center / newsletter.
drop policy if exists "email_events_staff" on public.email_outbound_events;
create policy "email_events_staff" on public.email_outbound_events
  for select to authenticated using (public.is_administrator(auth.uid()));

drop policy if exists "email_templates_staff_select" on public.email_templates;
create policy "email_templates_staff_select" on public.email_templates
  for select to authenticated using (public.is_administrator(auth.uid()));
drop policy if exists "email_templates_staff_insert" on public.email_templates;
create policy "email_templates_staff_insert" on public.email_templates
  for insert to authenticated with check (public.is_administrator(auth.uid()));
drop policy if exists "email_templates_staff_update" on public.email_templates;
create policy "email_templates_staff_update" on public.email_templates
  for update to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));
drop policy if exists "email_templates_staff_delete" on public.email_templates;
create policy "email_templates_staff_delete" on public.email_templates
  for delete to authenticated using (public.is_administrator(auth.uid()));

drop policy if exists "email_inbox_staff" on public.email_inbox_messages;
create policy "email_inbox_staff" on public.email_inbox_messages
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));
drop policy if exists "email_inbox_attachments_staff" on public.email_inbox_attachments;
create policy "email_inbox_attachments_staff" on public.email_inbox_attachments
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));
drop policy if exists "email_drafts_staff" on public.email_drafts;
create policy "email_drafts_staff" on public.email_drafts
  for all to authenticated
  using (public.is_administrator(auth.uid()) and created_by = auth.uid())
  with check (public.is_administrator(auth.uid()) and created_by = auth.uid());
drop policy if exists "email_inbox_attachments_storage_staff" on storage.objects;
create policy "email_inbox_attachments_storage_staff" on storage.objects
  for all to authenticated
  using (bucket_id = 'email-inbox-attachments' and public.is_administrator(auth.uid()))
  with check (bucket_id = 'email-inbox-attachments' and public.is_administrator(auth.uid()));

drop policy if exists "email_automations_staff_select" on public.email_automations;
create policy "email_automations_staff_select" on public.email_automations
  for select to authenticated using (public.is_administrator(auth.uid()));
drop policy if exists "email_automations_staff_update" on public.email_automations;
create policy "email_automations_staff_update" on public.email_automations
  for update to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()) and hosted_by_supabase = false);
drop policy if exists "email_automations_staff_insert" on public.email_automations;
create policy "email_automations_staff_insert" on public.email_automations
  for insert to authenticated with check (public.is_administrator(auth.uid()));

drop policy if exists "newsletter_subscribers_staff_all" on public.newsletter_subscribers;
create policy "newsletter_subscribers_staff_all" on public.newsletter_subscribers
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));
drop policy if exists "newsletter_campaigns_staff_all" on public.newsletter_campaigns;
create policy "newsletter_campaigns_staff_all" on public.newsletter_campaigns
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));
drop policy if exists "newsletter_recipients_staff_all" on public.newsletter_campaign_recipients;
create policy "newsletter_recipients_staff_all" on public.newsletter_campaign_recipients
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

-- Website / CMS administration.
drop policy if exists "website_partners_public_select" on public.website_partners;
create policy "website_partners_public_select" on public.website_partners
  for select to anon, authenticated
  using (is_active = true or public.is_administrator(auth.uid()));
drop policy if exists "website_partners_staff_all" on public.website_partners;
create policy "website_partners_staff_all" on public.website_partners
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

drop policy if exists "blog_posts_public_select" on public.blog_posts;
create policy "blog_posts_public_select" on public.blog_posts
  for select to anon, authenticated
  using (status = 'published' or public.is_administrator(auth.uid()));
drop policy if exists "blog_posts_staff_all" on public.blog_posts;
create policy "blog_posts_staff_all" on public.blog_posts
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

drop policy if exists "cms_pages_public_select" on public.cms_pages;
create policy "cms_pages_public_select" on public.cms_pages
  for select to anon, authenticated
  using (status = 'published' or public.is_administrator(auth.uid()));
drop policy if exists "cms_pages_staff_all" on public.cms_pages;
create policy "cms_pages_staff_all" on public.cms_pages
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

drop policy if exists "cms_media_staff_all" on public.cms_media;
create policy "cms_media_staff_all" on public.cms_media
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));
drop policy if exists "cms_media_staff_insert" on storage.objects;
create policy "cms_media_staff_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cms-media'
    and public.is_administrator(auth.uid())
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "cms_media_staff_update" on storage.objects;
create policy "cms_media_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'cms-media' and public.is_administrator(auth.uid()))
  with check (bucket_id = 'cms-media' and public.is_administrator(auth.uid()));
drop policy if exists "cms_media_staff_delete" on storage.objects;
create policy "cms_media_staff_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cms-media' and public.is_administrator(auth.uid()));

drop policy if exists "website_settings_staff_all" on public.website_settings;
create policy "website_settings_staff_all" on public.website_settings
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));
drop policy if exists "website_videos_public_select" on public.website_videos;
create policy "website_videos_public_select" on public.website_videos
  for select to anon, authenticated
  using (published = true or public.is_administrator(auth.uid()));
drop policy if exists "website_videos_staff_all" on public.website_videos;
create policy "website_videos_staff_all" on public.website_videos
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

-- Release deal details are contract/finance-adjacent: owner or administrator only.
drop policy if exists "release_deals_select" on public.release_deals;
create policy "release_deals_select" on public.release_deals
  for select to authenticated
  using (
    public.is_administrator(auth.uid())
    or exists (select 1 from public.releases r where r.id = release_id and r.owner_user_id = auth.uid())
  );
drop policy if exists "release_deals_staff_all" on public.release_deals;
create policy "release_deals_staff_all" on public.release_deals
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

-- DDEX operational data and private package storage.
drop policy if exists "ddex_messages_staff_select" on public.ddex_messages;
create policy "ddex_messages_staff_select" on public.ddex_messages
  for select to authenticated using (public.is_administrator(auth.uid()));
drop policy if exists "ddex_messages_staff_write" on public.ddex_messages;
create policy "ddex_messages_staff_write" on public.ddex_messages
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

drop policy if exists "ddex_ern_staff_select" on storage.objects;
create policy "ddex_ern_staff_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'ddex-ern' and public.is_administrator(auth.uid()));
drop policy if exists "ddex_ern_staff_insert" on storage.objects;
create policy "ddex_ern_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ddex-ern' and public.is_administrator(auth.uid()));
drop policy if exists "ddex_ern_staff_update" on storage.objects;
create policy "ddex_ern_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'ddex-ern' and public.is_administrator(auth.uid()))
  with check (bucket_id = 'ddex-ern' and public.is_administrator(auth.uid()));

drop policy if exists "dsp_targets_staff_select" on public.dsp_targets;
create policy "dsp_targets_staff_select" on public.dsp_targets
  for select to authenticated using (public.is_administrator(auth.uid()));
drop policy if exists "dsp_targets_staff_write" on public.dsp_targets;
create policy "dsp_targets_staff_write" on public.dsp_targets
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

drop policy if exists "ddex_validation_runs_staff_select" on public.ddex_validation_runs;
create policy "ddex_validation_runs_staff_select" on public.ddex_validation_runs
  for select to authenticated using (public.is_administrator(auth.uid()));
drop policy if exists "ddex_validation_runs_staff_write" on public.ddex_validation_runs;
create policy "ddex_validation_runs_staff_write" on public.ddex_validation_runs
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

drop policy if exists "ddex_delivery_attempts_staff_all" on public.ddex_delivery_attempts;
create policy "ddex_delivery_attempts_staff_all" on public.ddex_delivery_attempts
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));
drop policy if exists "ddex_acknowledgments_staff_all" on public.ddex_acknowledgments;
create policy "ddex_acknowledgments_staff_all" on public.ddex_acknowledgments
  for all to authenticated
  using (public.is_administrator(auth.uid()))
  with check (public.is_administrator(auth.uid()));

drop policy if exists "ddex_packages_staff_select" on storage.objects;
create policy "ddex_packages_staff_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'ddex-packages' and public.is_administrator(auth.uid()));
drop policy if exists "ddex_packages_staff_insert" on storage.objects;
create policy "ddex_packages_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ddex-packages' and public.is_administrator(auth.uid()));
drop policy if exists "ddex_packages_staff_update" on storage.objects;
create policy "ddex_packages_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'ddex-packages' and public.is_administrator(auth.uid()))
  with check (bucket_id = 'ddex-packages' and public.is_administrator(auth.uid()));

-- End RLS changes. Security-definer RPCs below are also hardened so a Support
-- user cannot bypass these policies by invoking privileged functions directly.

-- Harden admin_set_account_status
create or replace function public.admin_set_account_status(
  p_target uuid,
  p_status public.account_status,
  p_reason text,
  p_restriction public.account_restriction_kind default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  p public.profiles;
  act text;
begin
  if actor is null or not (
    public.has_role(actor, 'admin') or public.has_role(actor, 'super_admin')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Reason required' using errcode = 'P0001';
  end if;
  if public.has_role(p_target, 'super_admin') and not public.has_role(actor, 'super_admin') then
    raise exception 'Cannot modify super_admin' using errcode = '42501';
  end if;

  select * into p from public.profiles where id = p_target for update;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;

  act := case
    when p_status = 'suspended' then 'suspend'
    when p_status = 'deactivated' then 'deactivate'
    when p_status = 'active' then 'restore'
    else 'restrict'
  end;

  update public.profiles
  set account_status = p_status,
      restriction_kind = coalesce(p_restriction, restriction_kind),
      updated_at = now()
  where id = p_target
  returning * into p;

  insert into public.account_actions (target_user_id, actor_user_id, action, restriction_kind, reason)
  values (p_target, actor, act, coalesce(p_restriction, p.restriction_kind), p_reason);

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    case when act = 'restore' then 'account_restore'::public.audit_action
         when act = 'restrict' then 'account_restrict'::public.audit_action
         else 'account_suspend'::public.audit_action end,
    'profile', p_target,
    jsonb_build_object('status', p_status::text, 'reason', p_reason)
  );

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
  values (
    p_target, 'account_status',
    'Account status updated',
    'Your account status is now ' || p_status::text || '.',
    'profile', p_target
  );

  return p;
end;
$$;

-- Harden queue_approved_release
create or replace function public.queue_approved_release(
  p_release_id uuid,
  p_notes text default null
)
returns public.distribution_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  r public.releases;
  job public.distribution_jobs;
  provider_key text;
begin
  if actor is null or not public.is_administrator(actor) then
    raise exception 'Administrator only' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if r.status not in ('approved', 'scheduled', 'failed') then
    raise exception 'Only approved/scheduled/failed releases can be queued (got %)', r.status
      using errcode = 'P0001';
  end if;

  if r.status in ('approved', 'failed') then
    perform set_config('nexo.trusted_status_transition', '1', true);
    begin
      perform public.transition_release_status(
        p_release_id,
        'scheduled',
        coalesce(p_notes, 'Queued for distribution'),
        jsonb_build_object('source', 'queue_approved_release')
      );
    exception when others then
      perform set_config('nexo.trusted_status_transition', '0', true);
      raise;
    end;
    perform set_config('nexo.trusted_status_transition', '0', true);
  end if;

  provider_key := case
    when r.provider_name is null
      or btrim(r.provider_name) = ''
      or lower(btrim(r.provider_name)) = 'not_connected'
      then 'distribution_engine'
    else btrim(r.provider_name)
  end;

  insert into public.distribution_jobs (
    release_id, provider_name, status, created_by, metadata
  ) values (
    p_release_id,
    provider_key,
    'queued',
    actor,
    jsonb_build_object('notes', p_notes)
  )
  on conflict (release_id, provider_name) do update
    set status = case
          when public.distribution_jobs.status in ('delivered', 'live', 'taken_down')
            then public.distribution_jobs.status
          else 'queued'
        end,
        last_error = null,
        queued_at = now(),
        updated_at = now(),
        metadata = public.distribution_jobs.metadata || jsonb_build_object('requeued_at', now())
  returning * into job;

  perform public.write_audit_log(
    'distribution_queue'::public.audit_action,
    'release',
    p_release_id,
    jsonb_build_object('job_id', job.id, 'notes', p_notes)
  );

  perform public.enqueue_distribution_email(
    p_release_id,
    'release_queued_for_distribution',
    jsonb_build_object('job_id', job.id, 'status', 'queued')
  );

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
  values (
    r.owner_user_id,
    'distribution_update',
    'Release queued for distribution',
    'Your release was queued for Distribution Engine delivery.',
    'release',
    p_release_id
  );

  return job;
end;
$$;

-- Harden begin_submit_queued_release
create or replace function public.begin_submit_queued_release(
  p_job_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  job public.distribution_jobs;
  existing public.provider_submissions;
  sub public.provider_submissions;
begin
  if actor is null or not public.is_administrator(actor) then
    raise exception 'Administrator only' using errcode = '42501';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key required' using errcode = 'P0001';
  end if;

  select * into job from public.distribution_jobs where id = p_job_id for update;
  if not found then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  select * into existing
  from public.provider_submissions
  where provider_name = job.provider_name and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'idempotent', true,
      'submission_id', existing.id,
      'job_id', job.id,
      'status', existing.status,
      'provider_release_id', existing.provider_release_id
    );
  end if;

  if job.status not in ('queued', 'failed') then
    raise exception 'Job status % cannot be submitted', job.status using errcode = 'P0001';
  end if;

  update public.distribution_jobs
  set status = 'submitting', started_at = coalesce(started_at, now()), updated_at = now()
  where id = job.id
  returning * into job;

  insert into public.provider_submissions (
    job_id, release_id, provider_name, attempt_number, status, idempotency_key
  ) values (
    job.id,
    job.release_id,
    job.provider_name,
    job.retry_count + 1,
    'pending',
    p_idempotency_key
  )
  returning * into sub;

  return jsonb_build_object(
    'idempotent', false,
    'submission_id', sub.id,
    'job_id', job.id,
    'release_id', job.release_id,
    'provider_name', job.provider_name,
    'status', 'pending'
  );
end;
$$;

-- Harden complete_submit_queued_release
create or replace function public.complete_submit_queued_release(
  p_submission_id uuid,
  p_ok boolean,
  p_provider_release_id text default null,
  p_response_ref text default null,
  p_response_payload jsonb default null,
  p_error_code text default null,
  p_error_message text default null
)
returns public.distribution_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  sub public.provider_submissions;
  job public.distribution_jobs;
begin
  if actor is null or not public.is_administrator(actor) then
    raise exception 'Administrator only' using errcode = '42501';
  end if;

  select * into sub from public.provider_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  select * into job from public.distribution_jobs where id = sub.job_id for update;

  if p_ok then
    if p_provider_release_id is null or length(trim(p_provider_release_id)) = 0 then
      raise exception 'provider_release_id required on success' using errcode = 'P0001';
    end if;

    update public.provider_submissions
    set status = 'accepted',
        provider_release_id = p_provider_release_id,
        response_ref = p_response_ref,
        response_payload = coalesce(p_response_payload, '{}'::jsonb),
        completed_at = now()
    where id = sub.id;

    update public.distribution_jobs
    set status = 'submitted',
        provider_release_id = p_provider_release_id,
        response_ref = p_response_ref,
        submitted_at = now(),
        last_error = null,
        updated_at = now()
    where id = job.id
    returning * into job;

    -- Mark release delivering only when provider_connected already true
    perform set_config('nexo.internal_release_update', '1', true);
    update public.releases
    set provider_release_id = p_provider_release_id,
        provider_name = job.provider_name,
        provider_status = 'submitted',
        provider_connected = true,
        updated_at = now()
    where id = job.release_id;
    perform set_config('nexo.internal_release_update', '0', true);

    begin
      perform public.transition_release_status(
        job.release_id,
        'delivering',
        'Submitted to distribution provider',
        jsonb_build_object('source', 'complete_submit_queued_release', 'submission_id', sub.id)
      );
    exception when others then
      -- leave job submitted; status transition may fail if already delivering
      null;
    end;

    perform public.enqueue_distribution_email(
      job.release_id,
      'release_distributing',
      jsonb_build_object('job_id', job.id)
    );

    perform public.write_audit_log(
      'distribution_submit'::public.audit_action,
      'release',
      job.release_id,
      jsonb_build_object('ok', true, 'submission_id', sub.id, 'provider_release_id', p_provider_release_id)
    );
  else
    update public.provider_submissions
    set status = 'failed',
        error_code = coalesce(p_error_code, 'SUBMIT_FAILED'),
        error_message = p_error_message,
        response_payload = coalesce(p_response_payload, '{}'::jsonb),
        completed_at = now()
    where id = sub.id;

    update public.distribution_jobs
    set status = 'failed',
        retry_count = retry_count + 1,
        last_error = coalesce(p_error_message, p_error_code, 'Submit failed'),
        next_retry_at = now() + (interval '15 minutes' * least(retry_count + 1, 8)),
        updated_at = now()
    where id = job.id
    returning * into job;

    insert into public.distribution_retries (
      job_id, release_id, attempt_number, reason, outcome, error_message, created_by, finished_at
    ) values (
      job.id, job.release_id, job.retry_count,
      coalesce(p_error_code, 'submit_failed'),
      case when p_error_code = 'PROVIDER_NOT_CONNECTED' then 'unavailable' else 'failed' end,
      p_error_message,
      actor,
      now()
    );

    begin
      perform public.transition_release_status(
        job.release_id,
        'failed',
        coalesce(p_error_message, 'Distribution submit failed'),
        jsonb_build_object('source', 'complete_submit_queued_release', 'error_code', p_error_code)
      );
    exception when others then
      null;
    end;

    perform public.enqueue_distribution_email(
      job.release_id,
      'release_distribution_failed',
      jsonb_build_object('job_id', job.id, 'error', p_error_message)
    );

    perform public.write_audit_log(
      'distribution_submit'::public.audit_action,
      'release',
      job.release_id,
      jsonb_build_object('ok', false, 'submission_id', sub.id, 'error_code', p_error_code)
    );
  end if;

  return job;
end;
$$;

-- Harden record_provider_sync_run
create or replace function public.record_provider_sync_run(
  p_job_id uuid,
  p_status text,
  p_provider_status text default null,
  p_delivery_status text default null,
  p_error_message text default null,
  p_response_ref text default null
)
returns public.provider_sync_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  job public.distribution_jobs;
  run public.provider_sync_runs;
begin
  if actor is null or not public.is_administrator(actor) then
    raise exception 'Administrator only' using errcode = '42501';
  end if;

  if p_status not in ('started', 'succeeded', 'failed', 'unavailable') then
    raise exception 'Invalid sync status' using errcode = 'P0001';
  end if;

  select * into job from public.distribution_jobs where id = p_job_id;
  if not found then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  insert into public.provider_sync_runs (
    job_id, release_id, provider_name, trigger_source, status,
    provider_status, delivery_status, error_message, response_ref,
    created_by, finished_at
  ) values (
    job.id, job.release_id, job.provider_name, 'admin', p_status,
    p_provider_status, p_delivery_status, p_error_message, p_response_ref,
    actor,
    case when p_status = 'started' then null else now() end
  )
  returning * into run;

  if p_status in ('succeeded', 'failed', 'unavailable') then
    update public.distribution_jobs
    set last_sync_at = now(),
        last_error = case when p_status = 'succeeded' then null else coalesce(p_error_message, last_error) end,
        updated_at = now()
    where id = job.id;
  end if;

  perform public.write_audit_log(
    'distribution_sync'::public.audit_action,
    'release',
    job.release_id,
    jsonb_build_object('run_id', run.id, 'status', p_status)
  );

  return run;
end;
$$;

-- Harden request_distribution_takedown
create or replace function public.request_distribution_takedown(
  p_release_id uuid,
  p_reason text default null
)
returns public.releases
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  r public.releases;
  staff boolean;
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  staff := public.is_administrator(actor);
  if not staff and r.owner_user_id <> actor then
    raise exception 'Not permitted' using errcode = '42501';
  end if;

  r := public.transition_release_status(
    p_release_id,
    'takedown_requested',
    coalesce(p_reason, 'Takedown requested'),
    jsonb_build_object('source', 'request_distribution_takedown')
  );

  update public.distribution_jobs
  set status = 'takedown_requested', updated_at = now()
  where release_id = p_release_id
    and status in ('queued', 'submitting', 'submitted', 'syncing', 'delivered', 'live', 'failed');

  perform public.enqueue_distribution_email(
    p_release_id,
    'release_takedown_requested',
    jsonb_build_object('reason', p_reason)
  );

  if staff then
    perform public.write_audit_log(
      'distribution_takedown'::public.audit_action,
      'release',
      p_release_id,
      jsonb_build_object('reason', p_reason)
    );
  else
    perform public.write_audit_log(
      'release_takedown_request'::public.audit_action,
      'release',
      p_release_id,
      jsonb_build_object('reason', p_reason)
    );
  end if;

  return r;
end;
$$;

-- Harden reinstate_distribution_release
create or replace function public.reinstate_distribution_release(
  p_release_id uuid,
  p_reason text default null
)
returns public.releases
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  r public.releases;
  target public.release_status;
begin
  if actor is null or not public.is_administrator(actor) then
    raise exception 'Administrator only' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if r.status not in ('takedown_requested', 'taken_down') then
    raise exception 'Reinstate only from takedown states' using errcode = 'P0001';
  end if;

  target := case
    when r.provider_connected and r.provider_status in ('live', 'delivered') then 'live'
    when r.provider_connected then 'delivered'
    else 'approved'
  end;

  if r.status = 'taken_down' then
    perform set_config('nexo.internal_release_update', '1', true);
    insert into public.release_status_history (release_id, previous_status, new_status, actor_user_id, reason, metadata)
    values (r.id, r.status, target, actor, coalesce(p_reason, 'Reinstated'), jsonb_build_object('source', 'reinstate_distribution_release'));
    update public.releases set status = target, updated_at = now() where id = r.id returning * into r;
    perform set_config('nexo.internal_release_update', '0', true);
  else
    perform set_config('nexo.trusted_status_transition', '1', true);
    begin
      r := public.transition_release_status(
        p_release_id,
        case when target = 'approved' then 'live' else target end,
        coalesce(p_reason, 'Reinstated'),
        jsonb_build_object('source', 'reinstate_distribution_release')
      );
    exception when others then
      perform set_config('nexo.trusted_status_transition', '0', true);
      raise;
    end;
    perform set_config('nexo.trusted_status_transition', '0', true);
  end if;

  update public.distribution_jobs
  set status = case when target in ('live', 'delivered') then target::text::public.distribution_job_status else 'queued' end,
      updated_at = now()
  where release_id = p_release_id;

  perform public.enqueue_distribution_email(
    p_release_id,
    'release_reinstated',
    jsonb_build_object('status', r.status)
  );

  perform public.write_audit_log(
    'distribution_reinstate'::public.audit_action,
    'release',
    p_release_id,
    jsonb_build_object('reason', p_reason, 'new_status', r.status)
  );

  return r;
end;
$$;

-- Harden create_catalog_migration
create or replace function public.create_catalog_migration(
  p_owner_user_id uuid,
  p_artist_profile_id uuid default null,
  p_label_profile_id uuid default null,
  p_source_name text default 'unconfigured',
  p_title text default null,
  p_notes text default null
)
returns public.catalog_migrations
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  m public.catalog_migrations;
  connected boolean := false;
begin
  if actor is null or not public.is_administrator(actor) then
    raise exception 'Administrator only' using errcode = '42501';
  end if;

  -- External sources are never auto-connected without credentials
  connected := false;

  insert into public.catalog_migrations (
    owner_user_id, artist_profile_id, label_profile_id,
    source_name, source_connected, status, title, notes,
    external_catalog_unavailable_reason, created_by
  ) values (
    p_owner_user_id,
    p_artist_profile_id,
    p_label_profile_id,
    coalesce(nullif(trim(p_source_name), ''), 'unconfigured'),
    connected,
    case when connected then 'draft' else 'unavailable' end,
    p_title,
    p_notes,
    case when not connected then
      'External catalog source is not connected. Discovery cannot invent releases.'
    else null end,
    actor
  )
  returning * into m;

  perform public.write_audit_log(
    'catalog_migration'::public.audit_action,
    'catalog_migration',
    m.id,
    jsonb_build_object('source_name', m.source_name, 'status', m.status)
  );

  return m;
end;
$$;

-- Harden offer_old_distributor_takedown
create or replace function public.offer_old_distributor_takedown(
  p_migration_id uuid
)
returns public.catalog_migrations
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  m public.catalog_migrations;
begin
  if actor is null or not public.is_administrator(actor) then
    raise exception 'Administrator only' using errcode = '42501';
  end if;

  select * into m from public.catalog_migrations where id = p_migration_id for update;
  if not found then
    raise exception 'Migration not found' using errcode = 'P0002';
  end if;

  -- Only after delivery verified — never automatic
  if m.delivery_verified_at is null or not m.old_distributor_takedown_eligible then
    raise exception 'Old-distributor takedown only offered after delivery is verified'
      using errcode = 'P0001';
  end if;

  update public.catalog_migrations
  set old_distributor_takedown_offered = true, updated_at = now()
  where id = m.id
  returning * into m;

  perform public.write_audit_log(
    'catalog_migration'::public.audit_action,
    'catalog_migration',
    m.id,
    jsonb_build_object('action', 'offer_old_distributor_takedown')
  );

  return m;
end;
$$;

-- Harden upsert_artist_dsp_mapping
create or replace function public.upsert_artist_dsp_mapping(
  p_artist_profile_id uuid,
  p_dsp_name text,
  p_external_artist_id text default null,
  p_external_artist_uri text default null,
  p_external_artist_url text default null,
  p_verified boolean default false
)
returns public.artist_dsp_mappings
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  row public.artist_dsp_mappings;
begin
  if actor is null or not public.is_administrator(actor) then
    raise exception 'Administrator only' using errcode = '42501';
  end if;

  if p_dsp_name is null or length(trim(p_dsp_name)) = 0 then
    raise exception 'dsp_name required' using errcode = 'P0001';
  end if;

  insert into public.artist_dsp_mappings (
    artist_profile_id, dsp_name, external_artist_id, external_artist_uri,
    external_artist_url, verified, source_connected, created_by
  ) values (
    p_artist_profile_id, lower(trim(p_dsp_name)), p_external_artist_id,
    p_external_artist_uri, p_external_artist_url, coalesce(p_verified, false),
    false, -- never claim connected without real source credentials
    actor
  )
  on conflict (artist_profile_id, dsp_name) do update
    set external_artist_id = excluded.external_artist_id,
        external_artist_uri = excluded.external_artist_uri,
        external_artist_url = excluded.external_artist_url,
        verified = excluded.verified,
        updated_at = now()
  returning * into row;

  perform public.write_audit_log(
    'catalog_mapping'::public.audit_action,
    'artist_profile',
    p_artist_profile_id,
    jsonb_build_object('dsp_name', row.dsp_name, 'mapping_id', row.id)
  );

  return row;
end;
$$;

-- Harden import_own_catalog_migration_items
create or replace function public.import_own_catalog_migration_items(
  p_migration_id uuid,
  p_items jsonb
)
returns public.catalog_migrations
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  m public.catalog_migrations;
  item jsonb;
  gaps jsonb;
  upc_val text;
  isrcs text[];
  track_count_val int;
  cnt int := 0;
begin
  if actor is null then
    raise exception 'Auth required' using errcode = '42501';
  end if;

  select * into m from public.catalog_migrations
  where id = p_migration_id for update;
  if not found then
    raise exception 'Migration not found' using errcode = 'P0002';
  end if;
  if m.owner_user_id <> actor and not public.is_administrator(actor) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if m.status in ('completed', 'cancelled') then
    raise exception 'Migration is closed' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be a JSON array' using errcode = 'P0001';
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    gaps := '[]'::jsonb;
    upc_val := nullif(trim(coalesce(item->>'upc', item->>'external_upc', '')), '');

    select coalesce(array_agg(distinct upper(trim(v))) filter (where length(trim(v)) > 0), '{}'::text[])
    into isrcs
    from (
      select value as v
      from jsonb_array_elements_text(coalesce(item->'isrcs', '[]'::jsonb))
      union all
      select coalesce(track->>'isrc', '')
      from jsonb_array_elements(
        case when jsonb_typeof(item->'tracks') = 'array' then item->'tracks' else '[]'::jsonb end
      ) as track
    ) src;

    track_count_val := nullif(item->>'track_count', '')::int;
    if track_count_val is null and jsonb_typeof(item->'tracks') = 'array' then
      track_count_val := jsonb_array_length(item->'tracks');
    end if;
    if track_count_val is null and coalesce(array_length(isrcs,1),0) > 0 then
      track_count_val := array_length(isrcs,1);
    end if;

    if nullif(trim(coalesce(item->>'title', '')), '') is null then
      gaps := gaps || '["missing_title"]'::jsonb;
    end if;
    if nullif(trim(coalesce(item->>'artist_name', item->>'artistName', '')), '') is null then
      gaps := gaps || '["missing_artist"]'::jsonb;
    end if;
    if upc_val is null then
      gaps := gaps || '["missing_upc"]'::jsonb;
    end if;
    if coalesce(array_length(isrcs, 1), 0) = 0 then
      gaps := gaps || '["missing_isrc"]'::jsonb;
    end if;
    if coalesce(array_length(isrcs,1),0) > 1
       and not (jsonb_typeof(item->'tracks') = 'array' and jsonb_array_length(item->'tracks') > 0) then
      gaps := gaps || '["missing_track_titles"]'::jsonb;
    end if;

    insert into public.catalog_migration_items (
      migration_id, external_release_id, external_title, external_artist_name,
      external_upc, external_isrcs, external_track_count, external_payload,
      status, selected, metadata_gaps, previous_distributor, import_payload,
      isrc_preserved, upc_preserved
    ) values (
      m.id,
      nullif(trim(coalesce(item->>'external_release_id', item->>'id', '')), ''),
      nullif(trim(coalesce(item->>'title', '')), ''),
      nullif(trim(coalesce(item->>'artist_name', item->>'artistName', '')), ''),
      upc_val,
      isrcs,
      track_count_val,
      coalesce(item, '{}'::jsonb),
      'pending',
      coalesce((item->>'selected')::boolean, true),
      gaps,
      nullif(trim(coalesce(item->>'previous_distributor', m.previous_distributor, '')), ''),
      coalesce(item, '{}'::jsonb),
      false,
      false
    );
    cnt := cnt + 1;
  end loop;

  update public.catalog_migrations set
    item_count = (select count(*) from public.catalog_migration_items where migration_id = m.id),
    workflow_step = case when cnt > 0 then 'select' else workflow_step end,
    status = 'review',
    last_job_status = 'items_imported',
    last_job_message = format('Imported %s catalog item(s) for review. No identifiers were invented.', cnt),
    last_job_at = now(),
    updated_at = now()
  where id = m.id
  returning * into m;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'catalog_migration_import'::public.audit_action, 'catalog_migration', m.id, jsonb_build_object('imported', cnt));

  return m;
end;
$$;

-- Harden move_in_own_catalog_migration
create or replace function public.move_in_own_catalog_migration(
  p_migration_id uuid
)
returns public.catalog_migrations
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  m public.catalog_migrations;
  it public.catalog_migration_items;
  new_release_id uuid;
  imported int := 0;
  skipped int := 0;
  conflicted int := 0;
  dup_upc boolean;
  dup_isrc boolean;
  tracks_json jsonb;
  track jsonb;
  track_title text;
  track_isrc text;
  track_no int;
  inserted_tracks int;
  source_isrc_count int;
  inserted_isrc_count int;
begin
  if actor is null then
    raise exception 'Auth required' using errcode = '42501';
  end if;

  select * into m from public.catalog_migrations where id = p_migration_id for update;
  if not found then
    raise exception 'Migration not found' using errcode = 'P0002';
  end if;
  if m.owner_user_id <> actor and not public.is_administrator(actor) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if m.status = 'completed' then
    raise exception 'Migration already completed' using errcode = 'P0001';
  end if;

  update public.catalog_migrations set
    status = 'importing',
    workflow_step = 'move_in',
    last_job_status = 'importing',
    last_job_message = 'Creating draft releases from selected items…',
    last_job_at = now(),
    updated_at = now()
  where id = m.id;

  for it in
    select * from public.catalog_migration_items
    where migration_id = m.id
      and selected = true
      and status not in ('imported', 'skipped', 'conflict')
    order by created_at
  loop
    dup_upc := false;
    dup_isrc := false;

    if it.external_upc is not null then
      select exists(
        select 1 from public.releases r
        where r.upc = it.external_upc and r.owner_user_id = m.owner_user_id
      ) into dup_upc;
    end if;

    if coalesce(array_length(it.external_isrcs, 1), 0) > 0 then
      select exists(
        select 1
        from public.release_tracks t
        join public.releases r on r.id = t.release_id
        where r.owner_user_id = m.owner_user_id
          and t.isrc = any (it.external_isrcs)
      ) into dup_isrc;
    end if;

    if dup_upc or dup_isrc then
      conflicted := conflicted + 1;
      update public.catalog_migration_items set
        status = 'conflict',
        conflict_reason = case
          when dup_upc and dup_isrc then 'duplicate_upc_and_isrc'
          when dup_upc then 'duplicate_upc'
          else 'duplicate_isrc'
        end,
        updated_at = now()
      where id = it.id;

      if not exists (
        select 1 from public.catalog_migration_conflicts
        where migration_id = m.id and item_id = it.id and status = 'open'
      ) then
        insert into public.catalog_migration_conflicts (
          migration_id, item_id, conflict_type, details, status
        ) values (
          m.id, it.id,
          case when dup_upc then 'duplicate_upc' else 'duplicate_isrc' end,
          jsonb_build_object('upc', it.external_upc, 'isrcs', to_jsonb(it.external_isrcs)),
          'open'
        );
      end if;
      continue;
    end if;

    if it.external_title is null or length(trim(it.external_title)) = 0 then
      skipped := skipped + 1;
      update public.catalog_migration_items set
        status = 'skipped',
        notes = 'Skipped: missing release title.',
        updated_at = now()
      where id = it.id;
      continue;
    end if;

    tracks_json := case
      when jsonb_typeof(it.import_payload->'tracks') = 'array' then it.import_payload->'tracks'
      else '[]'::jsonb
    end;

    if coalesce(array_length(it.external_isrcs,1),0) > 1 and jsonb_array_length(tracks_json) = 0 then
      skipped := skipped + 1;
      update public.catalog_migration_items set
        status = 'skipped',
        notes = 'Skipped: multi-track releases require track titles so Nexo does not invent metadata.',
        metadata_gaps = coalesce(metadata_gaps,'[]'::jsonb) || '["missing_track_titles"]'::jsonb,
        updated_at = now()
      where id = it.id;
      continue;
    end if;

    insert into public.releases (
      owner_user_id, artist_profile_id, title, primary_artist_name,
      upc, status, description
    ) values (
      m.owner_user_id,
      m.artist_profile_id,
      it.external_title,
      coalesce(it.external_artist_name, ''),
      it.external_upc,
      'draft',
      case when m.previous_distributor is not null
        then 'Moved in from previous distributor: ' || m.previous_distributor
        else null end
    )
    returning id into new_release_id;

    inserted_tracks := 0;
    inserted_isrc_count := 0;
    source_isrc_count := coalesce(array_length(it.external_isrcs,1),0);

    if jsonb_array_length(tracks_json) > 0 then
      for track in select * from jsonb_array_elements(tracks_json)
      loop
        track_title := nullif(trim(coalesce(track->>'title','')), '');
        if track_title is null then
          continue;
        end if;
        track_no := coalesce(nullif(track->>'track_number','')::int, inserted_tracks + 1);
        track_isrc := upper(trim(coalesce(track->>'isrc','')));
        if track_isrc !~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$' then
          track_isrc := null;
        end if;

        insert into public.release_tracks (release_id, track_number, title, isrc)
        values (new_release_id, track_no, track_title, track_isrc);
        inserted_tracks := inserted_tracks + 1;
        if track_isrc is not null then inserted_isrc_count := inserted_isrc_count + 1; end if;
      end loop;
    else
      track_isrc := case
        when source_isrc_count = 1 and it.external_isrcs[1] ~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$'
          then it.external_isrcs[1]
        else null
      end;
      insert into public.release_tracks (release_id, track_number, title, isrc)
      values (new_release_id, 1, it.external_title, track_isrc);
      inserted_tracks := 1;
      if track_isrc is not null then inserted_isrc_count := 1; end if;
    end if;

    if inserted_tracks = 0 then
      delete from public.releases where id = new_release_id;
      skipped := skipped + 1;
      update public.catalog_migration_items set
        status = 'skipped',
        notes = 'Skipped: no usable track titles were supplied.',
        updated_at = now()
      where id = it.id;
      continue;
    end if;

    update public.catalog_migration_items set
      status = 'imported',
      matched_release_id = new_release_id,
      draft_release_id = new_release_id,
      isrc_preserved = source_isrc_count > 0 and inserted_isrc_count = source_isrc_count,
      upc_preserved = it.external_upc is not null,
      updated_at = now()
    where id = it.id;

    imported := imported + 1;
  end loop;

  update public.catalog_migrations set
    imported_count = (select count(*) from public.catalog_migration_items where migration_id = m.id and status = 'imported'),
    conflict_count = (select count(*) from public.catalog_migration_items where migration_id = m.id and status = 'conflict'),
    item_count = (select count(*) from public.catalog_migration_items where migration_id = m.id),
    status = case
      when exists (
        select 1 from public.catalog_migration_items
        where migration_id = m.id and selected = true and status in ('pending','ready','conflict','skipped','failed')
      ) then 'review'::public.catalog_migration_status
      when exists (
        select 1 from public.catalog_migration_items
        where migration_id = m.id and selected = true and status = 'imported'
      ) then 'completed'::public.catalog_migration_status
      else 'review'::public.catalog_migration_status
    end,
    workflow_step = case
      when exists (
        select 1 from public.catalog_migration_items
        where migration_id = m.id and selected = true and status in ('pending','ready','conflict','skipped','failed')
      ) then 'review'
      when exists (
        select 1 from public.catalog_migration_items
        where migration_id = m.id and selected = true and status = 'imported'
      ) then 'done'
      else 'review'
    end,
    completed_at = case
      when not exists (
        select 1 from public.catalog_migration_items
        where migration_id = m.id and selected = true and status in ('pending','ready','conflict','skipped','failed')
      ) and exists (
        select 1 from public.catalog_migration_items
        where migration_id = m.id and selected = true and status = 'imported'
      ) then now()
      else null
    end,
    last_job_status = case
      when conflicted > 0 or skipped > 0 then 'review_required'
      when imported > 0 then 'completed'
      else 'no_items'
    end,
    last_job_message = format(
      'Move In finished: %s draft release(s) created, %s conflict(s), %s skipped. Review is required for any unresolved item.',
      imported, conflicted, skipped
    ),
    last_job_at = now(),
    updated_at = now()
  where id = m.id
  returning * into m;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'catalog_migration_move_in'::public.audit_action, 'catalog_migration', m.id, jsonb_build_object('imported', imported, 'conflicts', conflicted, 'skipped', skipped));

  return m;
end;
$$;

-- Harden upsert_royalty_import_batch
create or replace function public.upsert_royalty_import_batch(
  p_source_provider text,
  p_report_id text,
  p_period_start date default null,
  p_period_end date default null,
  p_currency char(3) default null
)
returns public.royalty_import_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  b public.royalty_import_batches;
begin
  if actor is null or not public.is_administrator(actor) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into public.royalty_import_batches (
    source_provider, report_id, report_period_start, report_period_end, currency, created_by
  ) values (
    p_source_provider, p_report_id, p_period_start, p_period_end, p_currency, actor
  )
  on conflict (source_provider, report_id) do update
    set report_period_start = coalesce(excluded.report_period_start, royalty_import_batches.report_period_start),
        report_period_end = coalesce(excluded.report_period_end, royalty_import_batches.report_period_end),
        currency = coalesce(excluded.currency, royalty_import_batches.currency)
  returning * into b;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'royalty_import', 'royalty_import_batch', b.id,
          jsonb_build_object('source_provider', p_source_provider, 'report_id', p_report_id));
  return b;
end;
$$;

-- Harden upsert_royalty_import_row
create or replace function public.upsert_royalty_import_row(
  p_batch_id uuid,
  p_row_key text,
  p_raw jsonb,
  p_amount_minor bigint default null,
  p_currency char(3) default null,
  p_isrc text default null,
  p_upc text default null,
  p_territory char(2) default null,
  p_dsp_code text default null,
  p_period_start date default null,
  p_period_end date default null
)
returns public.royalty_import_rows
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  b public.royalty_import_batches;
  r public.royalty_import_rows;
begin
  if actor is null or not public.is_administrator(actor) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select * into b from public.royalty_import_batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found' using errcode = 'P0002'; end if;

  insert into public.royalty_import_rows (
    batch_id, source_provider, report_id, row_key, raw, amount_minor, currency,
    isrc, upc, territory, dsp_code, period_start, period_end
  ) values (
    b.id, b.source_provider, b.report_id, p_row_key, coalesce(p_raw, '{}'::jsonb),
    p_amount_minor, p_currency, p_isrc, p_upc, p_territory, p_dsp_code, p_period_start, p_period_end
  )
  on conflict (source_provider, report_id, row_key) do update
    set raw = excluded.raw,
        amount_minor = coalesce(excluded.amount_minor, royalty_import_rows.amount_minor),
        currency = coalesce(excluded.currency, royalty_import_rows.currency),
        isrc = coalesce(excluded.isrc, royalty_import_rows.isrc),
        upc = coalesce(excluded.upc, royalty_import_rows.upc),
        territory = coalesce(excluded.territory, royalty_import_rows.territory),
        dsp_code = coalesce(excluded.dsp_code, royalty_import_rows.dsp_code),
        period_start = coalesce(excluded.period_start, royalty_import_rows.period_start),
        period_end = coalesce(excluded.period_end, royalty_import_rows.period_end)
  where royalty_import_rows.match_status not in ('posted')
  returning * into r;

  if r is null then
    select * into r from public.royalty_import_rows
    where source_provider = b.source_provider and report_id = b.report_id and row_key = p_row_key;
  end if;

  update public.royalty_import_batches
  set row_count = (select count(*) from public.royalty_import_rows where batch_id = b.id)
  where id = b.id;

  return r;
end;
$$;

-- Harden set_payout_compliance_hold
create or replace function public.set_payout_compliance_hold(
  p_owner_user_id uuid,
  p_reason text,
  p_case_id uuid default null,
  p_active boolean default true
)
returns public.payout_compliance_holds
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  h public.payout_compliance_holds;
begin
  if actor is null or not public.is_administrator(actor) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_active then
    insert into public.payout_compliance_holds (owner_user_id, case_id, reason, active, created_by)
    values (p_owner_user_id, p_case_id, p_reason, true, actor)
    returning * into h;
  else
    update public.payout_compliance_holds
    set active = false, released_at = now(), released_by = actor
    where owner_user_id = p_owner_user_id and active = true
    returning * into h;
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'compliance_payout_hold', 'payout_compliance_hold', h.id,
          jsonb_build_object('active', p_active, 'owner', p_owner_user_id, 'reason', p_reason));
  return h;
end;
$$;

-- Harden admin_set_release_website
create or replace function public.admin_set_release_website(
  p_release_id uuid,
  p_published boolean default null,
  p_featured boolean default null,
  p_slug text default null,
  p_blurb text default null,
  p_sort_order int default null,
  p_playback_enabled boolean default null,
  p_embed_spotify text default null,
  p_embed_apple text default null,
  p_embed_youtube text default null
)
returns public.releases
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  r public.releases;
begin
  if actor is null or not public.is_administrator(actor) then
    raise exception 'Administrator only' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  update public.releases set
    website_published = coalesce(p_published, website_published),
    website_featured = coalesce(p_featured, website_featured),
    website_slug = case
      when p_slug is null then website_slug
      when nullif(trim(p_slug), '') is null then null
      else lower(regexp_replace(trim(p_slug), '[^a-z0-9-]+', '-', 'gi'))
    end,
    website_blurb = coalesce(p_blurb, website_blurb),
    website_sort_order = coalesce(p_sort_order, website_sort_order),
    website_playback_enabled = coalesce(p_playback_enabled, website_playback_enabled),
    website_embed_spotify_url = coalesce(p_embed_spotify, website_embed_spotify_url),
    website_embed_apple_url = coalesce(p_embed_apple, website_embed_apple_url),
    website_embed_youtube_url = coalesce(p_embed_youtube, website_embed_youtube_url),
    website_published_at = case
      when coalesce(p_published, website_published) = true
        and website_published_at is null then now()
      when coalesce(p_published, website_published) = false then null
      else website_published_at
    end,
    updated_at = now()
  where id = r.id
  returning * into r;

  perform public.write_audit_log(
    case when r.website_published then 'website_publish'::public.audit_action
         else 'website_unpublish'::public.audit_action end,
    'release',
    r.id,
    jsonb_build_object(
      'website_published', r.website_published,
      'website_featured', r.website_featured,
      'website_slug', r.website_slug
    )
  );

  return r;
end;
$$;

-- Harden admin_set_artist_website
create or replace function public.admin_set_artist_website(
  p_artist_profile_id uuid,
  p_published boolean default null,
  p_featured boolean default null,
  p_slug text default null,
  p_tagline text default null,
  p_bio_html text default null,
  p_bio_json jsonb default null,
  p_social_links jsonb default null,
  p_sort_order int default null,
  p_artist_name text default null,
  p_genres text[] default null,
  p_country text default null,
  p_avatar_url text default null,
  p_cover_url text default null
)
returns public.artist_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  a public.artist_profiles;
begin
  if actor is null or not public.is_administrator(actor) then
    raise exception 'Administrator only' using errcode = '42501';
  end if;

  update public.artist_profiles set
    website_published = coalesce(p_published, website_published),
    website_featured = coalesce(p_featured, website_featured),
    public_slug = case
      when p_slug is null then public_slug
      when nullif(trim(p_slug), '') is null then null
      else lower(regexp_replace(trim(p_slug), '[^a-z0-9-]+', '-', 'gi'))
    end,
    public_tagline = coalesce(p_tagline, public_tagline),
    public_bio_html = coalesce(p_bio_html, public_bio_html),
    public_bio_json = coalesce(p_bio_json, public_bio_json),
    social_links = coalesce(p_social_links, social_links),
    website_sort_order = coalesce(p_sort_order, website_sort_order),
    artist_name = coalesce(nullif(trim(p_artist_name), ''), artist_name),
    genres = coalesce(p_genres, genres),
    country = case when p_country is null then country else nullif(trim(p_country), '') end,
    avatar_url = case when p_avatar_url is null then avatar_url else nullif(trim(p_avatar_url), '') end,
    cover_url = case when p_cover_url is null then cover_url else nullif(trim(p_cover_url), '') end,
    updated_at = now()
  where id = p_artist_profile_id
  returning * into a;

  if not found then
    raise exception 'Artist not found' using errcode = 'P0002';
  end if;

  perform public.write_audit_log(
    'website_publish'::public.audit_action,
    'artist_profile',
    a.id,
    jsonb_build_object(
      'website_published', a.website_published,
      'public_slug', a.public_slug,
      'featured', a.website_featured
    )
  );

  return a;
end;
$$;

-- Harden admin_upsert_website_setting
create or replace function public.admin_upsert_website_setting(
  p_key text,
  p_value jsonb
)
returns public.website_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  row public.website_settings;
begin
  if actor is null or not public.is_administrator(actor) then
    raise exception 'Administrator only' using errcode = '42501';
  end if;
  if p_key is null or length(trim(p_key)) < 1 then
    raise exception 'Invalid key' using errcode = '22023';
  end if;

  insert into public.website_settings (key, value, updated_by)
  values (trim(p_key), coalesce(p_value, '{}'::jsonb), actor)
  on conflict (key) do update set
    value = excluded.value,
    updated_by = actor,
    updated_at = now()
  returning * into row;

  perform public.write_audit_log(
    'website_publish'::public.audit_action,
    'website_settings',
    null,
    jsonb_build_object('key', row.key)
  );

  return row;
end;
$$;

-- Harden admin_upsert_website_video
create or replace function public.admin_upsert_website_video(
  p_id uuid default null,
  p_title text default null,
  p_url text default null,
  p_thumbnail_url text default null,
  p_artist_id uuid default null,
  p_release_id uuid default null,
  p_track_id uuid default null,
  p_published boolean default null,
  p_sort_order int default null,
  p_delete boolean default false
)
returns public.website_videos
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  row public.website_videos;
begin
  if actor is null or not public.is_administrator(actor) then
    raise exception 'Administrator only' using errcode = '42501';
  end if;

  if p_delete and p_id is not null then
    delete from public.website_videos where id = p_id returning * into row;
    return row;
  end if;

  if p_id is null then
    if nullif(trim(coalesce(p_title, '')), '') is null or nullif(trim(coalesce(p_url, '')), '') is null then
      raise exception 'title and url required' using errcode = '22023';
    end if;
    insert into public.website_videos (
      title, url, thumbnail_url, artist_id, release_id, track_id, published, sort_order
    ) values (
      trim(p_title),
      trim(p_url),
      nullif(trim(coalesce(p_thumbnail_url, '')), ''),
      p_artist_id,
      p_release_id,
      p_track_id,
      coalesce(p_published, false),
      coalesce(p_sort_order, 0)
    )
    returning * into row;
  else
    update public.website_videos set
      title = coalesce(nullif(trim(p_title), ''), title),
      url = coalesce(nullif(trim(p_url), ''), url),
      thumbnail_url = case when p_thumbnail_url is null then thumbnail_url else nullif(trim(p_thumbnail_url), '') end,
      artist_id = coalesce(p_artist_id, artist_id),
      release_id = coalesce(p_release_id, release_id),
      track_id = coalesce(p_track_id, track_id),
      published = coalesce(p_published, published),
      sort_order = coalesce(p_sort_order, sort_order),
      updated_at = now()
    where id = p_id
    returning * into row;
    if not found then
      raise exception 'Video not found' using errcode = 'P0002';
    end if;
  end if;

  return row;
end;
$$;

-- Harden admin_enqueue_composed_email
create or replace function public.admin_enqueue_composed_email(p_to_email text,p_template_key text,p_payload jsonb,p_related_entity_type text)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); eid uuid;
begin
 if uid is null or not public.is_administrator(uid) then raise exception 'Administrator email permission required' using errcode='42501'; end if;
 insert into public.email_outbound_events(to_email,template_key,payload,status,related_entity_type)
 values(lower(btrim(p_to_email)),p_template_key,coalesce(p_payload,'{}'::jsonb),'queued',p_related_entity_type) returning id into eid;
 return eid;
end; $$;

-- Harden write_audit_log
create or replace function public.write_audit_log(
  p_action public.audit_action,
  p_entity_type text default 'user',
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  safe_meta jsonb;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentication required to write audit logs' using errcode = '42501';
  end if;

  if p_action in (
    'login', 'logout', 'profile_update', 'password_reset_request',
    'signup', 'email_verified', 'release_submit', 'release_update',
    'release_status_change', 'release_create', 'release_duplicate',
    'release_takedown_request', 'asset_upload',
    'login_password_success', 'otp_sent', 'otp_resent', 'otp_failed',
    'otp_verified', 'otp_expired',
    'playlist_pitch_create', 'playlist_pitch_submit', 'dsp_profile_update'
  ) then
    null;
  elsif p_action in (
    'qc_review', 'qc_claim', 'qc_bulk', 'ticket_update', 'compliance_update',
    'admin_search', 'contact_message', 'payout_status_change', 'royalty_adjustment',
    'account_suspend', 'account_restore', 'account_restrict',
    'distribution_queue', 'distribution_submit', 'distribution_sync',
    'distribution_webhook', 'distribution_takedown', 'distribution_reinstate',
    'distribution_retry', 'catalog_migration', 'catalog_mapping',
    'royalty_import', 'royalty_ledger_post', 'split_rule_change', 'statement_publish',
    'payout_create', 'payout_payment_op', 'payout_webhook', 'publishing_work_update',
    'publishing_share_change', 'fx_rate_unavailable', 'compliance_payout_hold',
    'website_publish', 'website_unpublish', 'cms_page_upsert', 'blog_post_upsert',
    'partner_upsert', 'catalog_migration_import', 'catalog_migration_move_in',
    'roster_artist_create', 'roster_artist_update', 'release_deal_upsert',
    'ddex_message_record', 'ddex_generate', 'ddex_validate', 'ddex_download',
    'ddex_package', 'ddex_queue', 'ddex_deliver', 'ddex_retry', 'ddex_ack',
    'ddex_update', 'ddex_takedown',
    'email_retry', 'email_template_write', 'email_manual_send',
    'email_compose_send', 'email_inbox_sync', 'email_automation_toggle',
    'billing_checkout_start', 'billing_webhook', 'billing_portal_session',
    'billing_subscription_sync',
    'playlist_pitch_review', 'contact_reply', 'staff_invite'
  ) then
    if p_action in (
      'qc_review', 'qc_claim', 'qc_bulk', 'ticket_update',
      'admin_search', 'contact_message', 'contact_reply'
    ) then
      if not public.is_staff(uid) then
        raise exception 'Audit action requires staff privileges' using errcode = '42501';
      end if;
    elsif not public.is_administrator(uid) then
      raise exception 'Audit action requires administrator privileges' using errcode = '42501';
    end if;
  elsif p_action in ('status_change', 'settings_update', 'report_export') then
    if not (public.has_role(uid, 'admin') or public.has_role(uid, 'super_admin')) then
      raise exception 'Audit action requires admin privileges' using errcode = '42501';
    end if;
  elsif p_action = 'role_change' then
    if not public.has_role(uid, 'super_admin') then
      raise exception 'role_change audit requires super_admin' using errcode = '42501';
    end if;
  else
    raise exception 'Audit action not allowed' using errcode = '42501';
  end if;

  safe_meta := coalesce(p_metadata, '{}'::jsonb)
    - 'password' - 'token' - 'access_token' - 'refresh_token' - 'service_role_key'
    - 'internal_note' - 'otp' - 'otp_code' - 'code' - 'code_hash' - 'plaintext_otp' - 'hash';

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, p_action, p_entity_type, coalesce(p_entity_id, uid), safe_meta)
  returning id into new_id;

  return new_id;
end;
$$;
