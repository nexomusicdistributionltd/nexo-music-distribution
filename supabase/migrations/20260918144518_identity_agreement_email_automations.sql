
insert into public.email_automations
  (key,catalog_key,name,trigger_label,recipient_type,enabled,dormant,hosted_by_supabase)
values
  ('IDENTITY_VERIFICATION_SUBMITTED','IDENTITY_VERIFICATION_SUBMITTED','Identity verification submitted','Live identity verification submitted','account_user',true,false,false),
  ('IDENTITY_VERIFICATION_APPROVED','IDENTITY_VERIFICATION_APPROVED','Identity verification approved','Admin approves identity verification','account_user',true,false,false),
  ('IDENTITY_VERIFICATION_DECLINED','IDENTITY_VERIFICATION_DECLINED','Identity verification declined','Admin declines identity verification','account_user',true,false,false),
  ('IDENTITY_VERIFICATION_INFO_REQUIRED','IDENTITY_VERIFICATION_INFO_REQUIRED','Identity information required','Admin requests additional identity information','account_user',true,false,false),
  ('AGREEMENT_SIGNED','AGREEMENT_SIGNED','Distribution agreement signed','Client signs distribution agreement','account_user',true,false,false)
on conflict (key) do update set
  catalog_key=excluded.catalog_key,
  name=excluded.name,
  trigger_label=excluded.trigger_label,
  recipient_type=excluded.recipient_type,
  enabled=true,
  dormant=false,
  hosted_by_supabase=false,
  updated_at=now();

insert into public.email_templates(key,name,category,subject,html_body)
values
('IDENTITY_VERIFICATION_SUBMITTED','Identity verification submitted','ops','Identity verification submitted',
'<h1>Identity verification submitted</h1><p>Hi {{FIRST_NAME}},</p><p>We received your live identity verification submission. It is now in Nexo''s review queue.</p><p><a href="{{CTA_URL}}">{{CTA_LABEL}}</a></p>'),
('IDENTITY_VERIFICATION_APPROVED','Identity verification approved','ops','Identity verification approved',
'<h1>Identity verification approved</h1><p>Hi {{FIRST_NAME}},</p><p>Your identity verification has been approved. Continue to your mandatory Nexo distribution agreement.</p><p><a href="{{CTA_URL}}">{{CTA_LABEL}}</a></p>'),
('IDENTITY_VERIFICATION_DECLINED','Identity verification declined','ops','Identity verification declined',
'<h1>Identity verification declined</h1><p>Hi {{FIRST_NAME}},</p><p>Reason: {{REASON}}</p><p><a href="{{CTA_URL}}">{{CTA_LABEL}}</a></p>'),
('IDENTITY_VERIFICATION_INFO_REQUIRED','Additional identity information required','ops','Additional identity information required',
'<h1>Additional identity information required</h1><p>Hi {{FIRST_NAME}},</p><p>{{REASON}}</p><p><a href="{{CTA_URL}}">{{CTA_LABEL}}</a></p>'),
('AGREEMENT_SIGNED','Distribution agreement signed','ops','Your Nexo distribution agreement is signed',
'<h1>Distribution agreement signed</h1><p>Hi {{FIRST_NAME}},</p><p>Your Nexo distribution agreement {{AGREEMENT_VERSION}} was signed at {{SIGNED_AT}} and stored with an execution hash.</p><p><a href="{{CTA_URL}}">{{CTA_LABEL}}</a></p>')
on conflict (key) do update set
  name=excluded.name,
  category=excluded.category,
  subject=excluded.subject,
  html_body=excluded.html_body,
  updated_at=now();
