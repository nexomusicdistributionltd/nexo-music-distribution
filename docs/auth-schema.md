# Auth schema notes (Batch 3)

## `profiles.id` is the user id

`public.profiles.id` is the primary key **and** a foreign key to `auth.users(id)`.

That value **is** the application user id. A separate `user_id` column on `profiles`
was **intentionally not added**: it would duplicate the primary key 1:1 and risk
drift between `id` and `user_id`.

| Table | How it points at the user |
|-------|---------------------------|
| `profiles` | `id` = `auth.users.id` |
| `user_roles` | `user_id` → `profiles.id` |
| `artist_profiles` | `user_id` (compat) and `profile_id` (canonical) → `profiles.id` |
| `label_profiles` | `user_id` → `profiles.id` |
| `audit_logs` | `actor_user_id` → `profiles.id` |

`artist_profiles.artist_name` is the canonical display name and is kept in sync
with `stage_name` by trigger. Application code should prefer `artist_name` and
fall back to `stage_name` (`artistNameOf()`).

`label_profiles.legal_business_name` is backfilled from `label_name`.

Optional on `profiles`: `timezone`, `language`.
