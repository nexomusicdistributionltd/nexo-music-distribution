-- Preserve failed historical attempts without presenting the old adapter-disabled state as current connectivity.
update public.provider_submissions
set error_code = 'HISTORICAL_ADAPTER_DISABLED',
    error_message = 'Historical attempt made before live Distribution Engine release delivery was enabled.'
where provider_name = 'distribution_engine'
  and error_code = 'PROVIDER_UNAVAILABLE'
  and error_message = 'Release delivery is awaiting the verified upstream release-create schema; no unverified payload will be sent.';

update public.distribution_jobs
set status = 'queued',
    last_error = null,
    next_retry_at = null,
    updated_at = now()
where provider_name = 'distribution_engine'
  and provider_release_id is null
  and status in ('queued','failed')
  and release_id in (
    select id from public.releases where status = 'scheduled'
  );
