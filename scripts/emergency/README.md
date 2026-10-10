# Emergency recovery — Phase 0 security lockdown

Recovery paths if something goes wrong after deploying the allowlist lockdown,
in the order you should reach for them.

## 1. A caregiver is locked out (sees an empty app) — `allowlist-repair.sql`

Their account may not be bound in `app_allowlist` (a typo or a different login
address). Verify the person is a family caregiver, create their account in the
dashboard if needed, then run `allowlist-repair.sql` in the SQL editor. It lists
accounts and bound/unbound entries, then inserts or binds the specified existing
account. Replace the placeholder email first. **0 rows affected means no account
exists yet.** A listed email alone grants nothing; access is tied to the user ID.

## 2. The database itself is broken — restore from backup

If a migration corrupted data or the app misbehaves in a way the allowlist
can't explain, do NOT experiment on production. Restore the fresh logical dump
taken immediately before the deploy (roles + schema + data files), or use PITR
if enabled. See https://supabase.com/docs/guides/platform/backups

## 3. Absolute last resort — `DANGER-reopen-legacy-policies.sql`

Reopens broad any-authenticated-user access to every table. Read the warning
header in the file first. It exists only so a catastrophic lockout of ALL
caregivers can't leave the family without the app during a care emergency.
It must be followed by immediate re-containment (fix the real problem, then
re-apply the lockdown migration).

These scripts live outside `supabase/migrations/` on purpose: nothing here is
ever applied automatically.
