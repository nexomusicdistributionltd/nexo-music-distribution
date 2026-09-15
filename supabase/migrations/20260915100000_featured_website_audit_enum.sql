-- Featured website + Move In Catalog — audit / notification enum extensions
-- Must commit before later migrations that reference these values.

alter type public.audit_action add value if not exists 'website_publish';
alter type public.audit_action add value if not exists 'website_unpublish';
alter type public.audit_action add value if not exists 'cms_page_upsert';
alter type public.audit_action add value if not exists 'blog_post_upsert';
alter type public.audit_action add value if not exists 'partner_upsert';
alter type public.audit_action add value if not exists 'catalog_migration_import';
alter type public.audit_action add value if not exists 'catalog_migration_move_in';

alter type public.notification_type add value if not exists 'website_update';
alter type public.notification_type add value if not exists 'blog_published';
