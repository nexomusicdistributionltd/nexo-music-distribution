-- Footer CMS completion + public showcase reliability.
-- Applied live as migration 20260918220157 / footer_pages_realtime_showcase.

insert into public.cms_pages (
  slug, title, page_kind, status, body_html, seo_title, seo_description
)
select *
from (
  values
    (
      'contact',
      'Talk with Nexo',
      'custom',
      'draft'::public.cms_page_status,
      '<h2>Reach us</h2><p><strong>NEXO MUSIC DISTRIBUTION LTD</strong></p><p>Public website: <a href="https://nexomusicdistribution.com">nexomusicdistribution.com</a></p><p>Email <a href="mailto:contact@nexomusicdistro.space">contact@nexomusicdistro.space</a> or use the message form. Additional inquiries: <a href="mailto:contact@nexomusicdistro.space">contact@nexomusicdistro.space</a>.</p>',
      'Contact NEXO Music Distribution',
      'Contact NEXO Music Distribution about distribution, publishing, pricing, or label partnerships.'
    ),
    (
      'pricing',
      'Plans for artists and labels.',
      'custom',
      'draft'::public.cms_page_status,
      '<h2>Music distribution plans</h2><p>NEXO MUSIC DISTRIBUTION LTD publishes plans for independent artists and labels. Artist Starter is free. Paid plans include a 7-day trial, and tax is calculated by Paddle at checkout.</p>',
      'Music Distribution Pricing for Artists & Labels',
      'Review NEXO Music Distribution plans for artists and labels. Paid plans include a 7-day trial and checkout tax is calculated by Paddle.'
    )
) as seed(slug, title, page_kind, status, body_html, seo_title, seo_description)
where not exists (
  select 1 from public.cms_pages existing where existing.slug = seed.slug
);

create or replace function public.sync_release_public_website_on_distribution_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('delivered'::public.release_status, 'live'::public.release_status)
     and (
       tg_op = 'INSERT'
       or old.status is distinct from new.status
     ) then
    new.website_published := true;
    new.website_published_at := coalesce(new.website_published_at, now());
  elsif new.status in ('takedown_requested'::public.release_status, 'taken_down'::public.release_status)
        and (
          tg_op = 'INSERT'
          or old.status is distinct from new.status
        ) then
    new.website_published := false;
  end if;

  return new;
end;
$$;

drop trigger if exists releases_sync_public_website_on_distribution_status
  on public.releases;

create trigger releases_sync_public_website_on_distribution_status
before insert or update of status
on public.releases
for each row
execute function public.sync_release_public_website_on_distribution_status();

update public.releases
set
  website_published = true,
  website_published_at = coalesce(website_published_at, now())
where status in ('delivered'::public.release_status, 'live'::public.release_status)
  and website_published is distinct from true;

update public.releases
set website_published = false
where status in ('takedown_requested'::public.release_status, 'taken_down'::public.release_status)
  and website_published is distinct from false;

comment on function public.sync_release_public_website_on_distribution_status() is
  'Publishes a release to public website catalog when real distribution reaches delivered/live and removes it on takedown states. Manual website unpublish remains possible after the status transition.';
