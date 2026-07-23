# Emergency recovery — Phase 0 security lockdown

Recovery paths if something goes wrong after deploying the allowlist lockdown,
in the order you should reach for them.

## 1. A caregiver is locked out (sees an empty app) — `allowlist-repair.sql`

By far the most likely failure: their login email isn't in `app_allowlist`
(typo, or they sign in with a different address). This is fixed by ADDING the
correct email — it never widens access beyond the family. Run the script's
steps in the Supabase SQL editor. Safe to run any time.

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
