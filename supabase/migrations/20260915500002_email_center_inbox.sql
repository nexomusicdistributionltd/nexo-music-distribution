-- Admin Email Center inbox (Zoho IMAP sync) + drafts.
-- Inbox is NEVER populated from email_outbound_events.
-- Mailbox passwords stay in server env — never stored here.

create table if not exists public.email_inbox_messages (
  id uuid primary key default gen_random_uuid(),
  folder text not null default 'INBOX',
  uid bigint not null,
  message_id text,
  in_reply_to text,
  references_header text,
  thread_key text not null default '',
  from_email text not null,
  from_name text,
  to_emails jsonb not null default '[]'::jsonb,
  cc_emails jsonb not null default '[]'::jsonb,
  bcc_emails jsonb not null default '[]'::jsonb,
  subject text not null default '',
  sent_at timestamptz,
  seen boolean not null default false,
  text_body text not null default '',
  html_body text not null default '',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (folder, uid)
);

create index if not exists email_inbox_messages_sent_at_idx
  on public.email_inbox_messages (sent_at desc nulls last);
create index if not exists email_inbox_messages_thread_idx
  on public.email_inbox_messages (thread_key, sent_at);
create index if not exists email_inbox_messages_seen_idx
  on public.email_inbox_messages (seen, sent_at desc);

comment on table public.email_inbox_messages is
  'Zoho IMAP sync cache. Not derived from email_outbound_events. HTML is sanitized before insert.';

create table if not exists public.email_inbox_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.email_inbox_messages (id) on delete cascade,
  filename text not null,
  content_type text not null default 'application/octet-stream',
  byte_size int not null default 0,
  sha256 text,
  trusted boolean not null default false,
  storage_bucket text,
  storage_path text,
  created_at timestamptz not null default now()
);

create index if not exists email_inbox_attachments_message_idx
  on public.email_inbox_attachments (message_id);

comment on table public.email_inbox_attachments is
  'Inbound attachment metadata. Untrusted types have no storage_path. Never stores mailbox passwords.';

create table if not exists public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  to_text text not null default '',
  cc_text text not null default '',
  bcc_text text not null default '',
  subject text not null default '',
  html_body text not null default '',
  in_reply_to text,
  references_header text,
  reply_to_inbox_id uuid references public.email_inbox_messages (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_drafts_created_by_idx
  on public.email_drafts (created_by, updated_at desc);

alter table public.email_inbox_messages enable row level security;
alter table public.email_inbox_attachments enable row level security;
alter table public.email_drafts enable row level security;

drop policy if exists "email_inbox_staff" on public.email_inbox_messages;
create policy "email_inbox_staff" on public.email_inbox_messages
  for all to authenticated
  using (public.is_admin_portal_staff(auth.uid()))
  with check (public.is_admin_portal_staff(auth.uid()));

drop policy if exists "email_inbox_attachments_staff" on public.email_inbox_attachments;
create policy "email_inbox_attachments_staff" on public.email_inbox_attachments
  for all to authenticated
  using (public.is_admin_portal_staff(auth.uid()))
  with check (public.is_admin_portal_staff(auth.uid()));

drop policy if exists "email_drafts_staff" on public.email_drafts;
create policy "email_drafts_staff" on public.email_drafts
  for all to authenticated
  using (public.is_admin_portal_staff(auth.uid()) and created_by = auth.uid())
  with check (public.is_admin_portal_staff(auth.uid()) and created_by = auth.uid());

revoke all on table public.email_inbox_messages from public;
revoke all on table public.email_inbox_attachments from public;
revoke all on table public.email_drafts from public;
grant select, insert, update, delete on table public.email_inbox_messages to authenticated;
grant select, insert, update, delete on table public.email_inbox_attachments to authenticated;
grant select, insert, update, delete on table public.email_drafts to authenticated;
grant all on table public.email_inbox_messages to service_role;
grant all on table public.email_inbox_attachments to service_role;
grant all on table public.email_drafts to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'email-inbox-attachments',
  'email-inbox-attachments',
  false,
  8388608,
  array['application/pdf','image/jpeg','image/png','image/gif','image/webp','text/plain','text/csv','application/zip']::text[]
)
on conflict (id) do nothing;

drop policy if exists "email_inbox_attachments_storage_staff" on storage.objects;
create policy "email_inbox_attachments_storage_staff" on storage.objects
  for all to authenticated
  using (bucket_id = 'email-inbox-attachments' and public.is_admin_portal_staff(auth.uid()))
  with check (bucket_id = 'email-inbox-attachments' and public.is_admin_portal_staff(auth.uid()));
