# NEXO Music Distribution

Public marketing website + **Batch 3 authentication** for **NEXO MUSIC DISTRIBUTION LTD**  
https://nexomusicdistribution.com

Digital Music Distribution | Publishing | Royalty Management  
Publishing division: **Nexo Publishing Group**

---

## How to run

```bash
cd /workspace/nexo-music-distribution
cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production build:

```bash
npm run build
npm start
```

---

## Environment variables

| Variable | Visibility | Purpose |
|----------|------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Optional privileged key — never prefix with `NEXT_PUBLIC_` |

**Note:** Some earlier project briefs mentioned `VITE_*` variables. This app is **Next.js** and uses `NEXT_PUBLIC_*` for client-exposed values.

Never commit `.env`, `.env.local`, or real secrets. `.env.example` is safe to commit.

---

## Supabase setup (Batch 3)

1. Create a project at [https://supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the Project URL and `anon` `public` key into `.env.local`.
3. (Optional) Copy the `service_role` key into `SUPABASE_SERVICE_ROLE_KEY` for server-only admin jobs — **do not** expose it to the browser.
4. Run the SQL migration in the Supabase SQL editor (or via Supabase CLI):

```bash
# Option A — SQL editor: paste (in order)
# supabase/migrations/20260912000001_auth_foundation.sql
# supabase/migrations/20260912230000_pre_merge_hardening.sql

# Option B — Supabase CLI
supabase db push
# or
supabase migration up
```

5. Auth settings (Authentication → URL configuration) — **MANUAL CONFIG REQUIRED** (this repo cannot write the dashboard):
   - **Site URL:** `https://nexomusicdistribution.com`
   - **Redirect URLs:**
     - `https://nexomusicdistribution.com/**`
     - `https://nexomusicdistribution.com/auth/callback`
     - `https://nexomusicdistribution.com/auth/callback?next=/reset-password`
     - `https://nexomusicdistribution.com/auth/confirm`
     - `https://nexomusicdistribution.com/reset-password`
   - Do not use `localhost` or `nexomusicdistro.space` as production auth origins (`nexomusicdistro.space` is Zoho SMTP From only).
   - Password recovery `redirectTo` is `/auth/callback?next=/reset-password` (PKCE exchange), not `/reset-password` itself.
6. Enable **Email** provider. Confirm email templates point at `/auth/confirm` or use the default PKCE `/auth/callback` flow.
7. Storage: migration creates a public `avatars` bucket + RLS. Confirm it exists under Storage.

### What the migration creates

- `profiles` — core account fields + `account_status` (`active` | `pending_verification` | `suspended` | `deactivated`). `profiles.id` **is** `auth.users.id` (no separate `user_id` — see `docs/auth-schema.md`). Optional `timezone` / `language`.
- `artist_profiles` / `label_profiles` (artist_name + profile_id; label legal_business_name / country / logo)
- `user_roles` — roles **only** in DB: `public_user`, `artist`, `label`, `support`, `admin`, `super_admin`
- `audit_logs` — login/logout/profile_update/role_change/status_change/signup/… (never passwords/tokens)
- Trigger `handle_new_user` (SECURITY DEFINER) creates profile + role + artist/label row on signup
- RLS: own profile only; **no role self-edit**; **no privileged self-signup** (staff roles cannot be chosen at register)

Public signup accepts **artist** or **label** only.

---

## Auth flow notes

| Path | Behavior |
|------|----------|
| `/register` | Artist or label registration → email verification |
| `/login` | Password sign-in; redirects by role |
| `/verify-email` | Resend verification; unverified users are limited |
| `/forgot-password` / `/reset-password` | Secure reset via Supabase email links |
| `/profile` | Avatar, name, email, type, country, member since, status; safe edits; role not editable |
| `/dashboard` | Artist/label home with real release counts |
| `/app/publishing` | Authenticated publishing nav (public marketing stays at `/publishing`) |
| `/app/artists` | Label roster shell (public For Artists stays at `/artists`) |
| `/support` | Authenticated support shell (public contact stays at `/contact`) |
| `/admin/*` | Admin/super_admin only |

**Redirects after login:** artist/label → `/dashboard`; admin/super_admin → `/admin`; support → `/support`.  
Suspended/deactivated accounts are blocked. Sessions persist via `@supabase/ssr` cookies.

**Guards:** `RequireAuth`, `RequireVerifiedEmail`, `RequireRole`, `RequireAdmin`, `RequireSuperAdmin` (middleware + server layouts).

**Security hardening:** blocked accounts are signed out (cookies cleared) before `/login?reason=account-blocked` — they are never redirected into `/dashboard`, `/admin`, or `/support`. Post-login `from` / auth `next` query params go through `safeRedirectPath` (relative same-origin paths only). Privilege changes on `profiles` are enforced by a BEFORE UPDATE trigger. Service role helpers live in `src/lib/supabase/admin.ts` (`server-only`). Checklist: `docs/auth-security-checklist.md`.

---

## Batch notes

### Batch 1–2 (preserved)

Theme tokens, logos, UI kit, public marketing pages, architecture stubs, and design system are **not** rebuilt or removed.

### Batch 3

Real Supabase Auth + PostgreSQL. No distribution API / Too Lost / fake DSP/royalties/releases.

### Batch 4 (dashboard + releases)

Artist/label portal: dashboard counts, release wizard, catalog, QC submit, notifications, settings, private audio/artwork storage, status history, NotConnectedProvider. See `docs/batch-4-architecture.md`. No DSP delivery.

### Public routes (unchanged URLs)

`/`, `/distribution`, `/publishing`, `/artists`, `/labels`, `/pricing`, `/services`, `/about`, `/contact`, `/faq`, `/get-started`, plus auth pages.

---

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 + design tokens in `src/app/globals.css`
- `@supabase/ssr` + `@supabase/supabase-js`
- `next-themes`, `lucide-react`, `simple-icons`

---

## Company

NEXO MUSIC DISTRIBUTION LTD  
https://nexomusicdistribution.com
