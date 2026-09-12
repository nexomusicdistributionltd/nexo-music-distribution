# Auth security checklist (pre-merge)

Use this after applying `supabase/migrations/20260912230000_pre_merge_hardening.sql`.
No fake seed data — use real test accounts you create in Supabase Auth.

## Automated

```bash
npm test
```

Covers `safeRedirectPath` / `isSafeRedirectPath` (open-redirect helper).

## 1. Blocked-account session loop (CRITICAL)

**SQL — mark a real test user blocked**

```sql
-- Replace the email with a real test account you created.
update public.profiles
set account_status = 'suspended'
where email = 'blocked-test@example.com';
```

**Manual**

1. Sign in as that user (or sign in first, then run the SQL).
2. Visit `/dashboard`, `/admin`, `/support`, `/profile` directly (typed URL).
   - Must land on `/login?reason=account-blocked`.
   - Auth cookies (`sb-*-auth-token*`) must be cleared (Application → Cookies).
3. While the session still existed, visit `/login` or `/register`.
   - Must **not** bounce to `/dashboard`, `/admin`, or `/support`.
   - Must stay on / redirect to `/login?reason=account-blocked` with no session.
4. Repeat with `account_status = 'deactivated'`.
5. Restore when done:

```sql
update public.profiles
set account_status = 'active'
where email = 'blocked-test@example.com';
```

## 2. Open redirect (HIGH)

**Manual**

1. Open `/login?from=https://evil.example` and sign in with a real account.
   - Must go to the role home (`/dashboard`, `/admin`, or `/support`), never off-site.
2. Repeat with `from=//evil.example`, `from=/%2f%2fevil.example`, `from=/\\evil.example`.
3. `/login?from=/profile` (safe relative path) should land on `/profile`.

## 3. Privilege BEFORE UPDATE trigger (MEDIUM)

```sql
-- As a normal authenticated user (not admin), this must fail:
update public.profiles
set account_type = 'admin'
where id = auth.uid();

update public.profiles
set account_status = 'active'
where id = auth.uid();
```

Expected: `42501` / “requires admin privileges”.

```sql
-- Confirm trigger exists
select tgname from pg_trigger
where tgrelid = 'public.profiles'::regclass
  and tgname = 'profiles_prevent_privilege_escalation';
```

Admin / super_admin (or service role, `auth.uid()` null) may still change type/status.
Email verification (`pending_verification` → `active`) must still succeed.

## 4. `write_audit_log` hardening (MEDIUM)

```sql
-- Allowed for any authenticated user:
select public.write_audit_log('login', 'user', auth.uid(), '{"method":"password"}'::jsonb);
select public.write_audit_log('profile_update', 'profile', auth.uid(), '{"fields":["display_name"]}'::jsonb);

-- Must fail for non-admin:
select public.write_audit_log('role_change', 'user', auth.uid(), '{}'::jsonb);
select public.write_audit_log('status_change', 'user', auth.uid(), '{}'::jsonb);

-- Secrets must be stripped even when the action is allowed:
select metadata from public.audit_logs
where actor_user_id = auth.uid()
order by created_at desc
limit 1;
-- After: select write_audit_log('login','user',auth.uid(), '{"password":"x","token":"y","ok":true}'::jsonb)
-- metadata must not contain password/token keys.
```

## 5. Service role is server-only (LOW)

- `getServiceRoleKey` lives in `src/lib/supabase/admin.ts` with `import "server-only"`.
- `src/lib/supabase/env.ts` must not export the service role key.
- No `"use client"` module may import `admin.ts` (build will fail if one does).

## 6. Schema alignment

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('timezone', 'language');

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'artist_profiles'
  and column_name in ('artist_name', 'country', 'avatar_url', 'cover_url', 'profile_id');

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'label_profiles'
  and column_name in ('legal_business_name', 'logo_url', 'description', 'country');

-- Signup still creates the extra columns
-- Register a new artist/label and check:
--   profiles.timezone / language (nullable)
--   artist_profiles.artist_name = stage_name, profile_id = user_id
--   label_profiles.legal_business_name = label_name
```

See `docs/auth-schema.md` for the `profiles.id` = `auth.users.id` decision.

## 7. RLS still in force (regression)

```sql
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'artist_profiles', 'label_profiles', 'user_roles', 'audit_logs')
order by tablename, policyname;
```

- Own profile select/update; users cannot change their `account_type` / `account_status` (RLS + trigger).
- `user_roles` is not self-writable except `super_admin`.
- Staff can read profiles / roles; only admin/super_admin update status via RLS.

## 8. Do not regress Batch 1–2

Marketing pages, logos, `DspMarquee`, and `src/architecture/distribution/provider.ts`
are unchanged in this hardening pass.
