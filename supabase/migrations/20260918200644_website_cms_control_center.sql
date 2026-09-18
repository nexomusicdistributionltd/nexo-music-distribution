-- Website CMS control center
-- Seeds editable footer configuration, homepage blog/video visibility, and Refund Policy CMS shell.

insert into public.cms_pages (slug, title, page_kind, status, body_html)
select
  'refund-policy',
  'Refund Policy',
  'legal',
  'draft'::public.cms_page_status,
  '<p>Review and publish the NEXO Music Distribution Refund Policy from the admin CMS.</p>'
where not exists (
  select 1 from public.cms_pages where slug = 'refund-policy'
);

insert into public.website_settings (key, value)
values (
  'footer',
  jsonb_build_object(
    'brand_text', 'NEXO MUSIC DISTRIBUTION LTD — digital music distribution, publishing, and royalty management for independent artists and labels. Publishing division: Nexo Publishing Group.',
    'contact_email', 'contact@nexomusicdistro.space',
    'inquiries_email', 'contact@nexomusicdistro.space',
    'website_url', 'https://nexomusicdistribution.com',
    'services_links', jsonb_build_array(
      jsonb_build_object('label','Distribution','href','/distribution'),
      jsonb_build_object('label','Publishing','href','/publishing'),
      jsonb_build_object('label','Services','href','/services'),
      jsonb_build_object('label','For Artists','href','/artists'),
      jsonb_build_object('label','For Labels','href','/labels')
    ),
    'company_links', jsonb_build_array(
      jsonb_build_object('label','Terms','href','/terms'),
      jsonb_build_object('label','Privacy','href','/privacy'),
      jsonb_build_object('label','Contact','href','/contact'),
      jsonb_build_object('label','Pricing','href','/pricing')
    ),
    'get_started_links', jsonb_build_array(
      jsonb_build_object('label','Apply now','href','/register'),
      jsonb_build_object('label','Sign in','href','/login'),
      jsonb_build_object('label','Get Started','href','/get-started'),
      jsonb_build_object('label','Support','href','/faq')
    ),
    'legal_links', jsonb_build_array(
      jsonb_build_object('label','Privacy Policy','href','/privacy'),
      jsonb_build_object('label','Terms of Service','href','/terms'),
      jsonb_build_object('label','Refund Policy','href','/refund-policy'),
      jsonb_build_object('label','Cookie Policy','href','/cookies')
    ),
    'bottom_links', jsonb_build_array(
      jsonb_build_object('label','Terms','href','/terms'),
      jsonb_build_object('label','Contact','href','/contact')
    )
  )
)
on conflict (key) do nothing;

update public.website_settings
set value = coalesce(value, '{}'::jsonb)
  || jsonb_build_object(
       'show_blog', coalesce(value->'show_blog', 'true'::jsonb),
       'show_videos', coalesce(value->'show_videos', 'true'::jsonb)
     ),
    updated_at = now()
where key = 'homepage';
