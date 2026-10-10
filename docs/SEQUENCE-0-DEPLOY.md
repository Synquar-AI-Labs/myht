# Sequence 0 — deploy checklist (release/sequence-0)

This ships: the Today-screen redesign + History diary + More shelf (the family
still runs the old 7-tab app), the recording reliability rebuild, the Phase 0
allowlist lockdown, and the medicine delete containment.

**Heads-up for the family:** the app will look completely different (and much
simpler) after this deploy. Tell them before, not after.

## 1. Before anything — verify the allowlist (owner, Supabase dashboard)

Run in the SQL editor:

```sql
select email, last_sign_in_at from auth.users order by last_sign_in_at desc;
```

Every caregiver's **login** email must appear EXACTLY in the migration's
allowlist (fahadakbar / umairakbar / shahwar / affantiger @gmail.com).
A mismatch means that caregiver is not approved. Fix mismatches
by editing the allowlist insert in
`supabase/migrations/20260722153000_phase0_security_lockdown.sql` **before**
deploying. The migration binds existing accounts by login email and stops if
users exist but none match. Unbound emails grant nothing. To add a caregiver
later, create the account in the dashboard, then run
`scripts/emergency/allowlist-repair.sql` to insert or bind that account.

Before deploying, run these read-only checks and send the results to @leader:

```sql
select date, count(*) from health_records group by date having count(*) > 1 order by date;
select (select count(*) from bp_readings) as bp, (select count(*) from medicine_logs) as doses, (select count(*) from custom_action_logs) as custom_logs;
```

## 2. Dashboard hardening (owner)

- Authentication → Sign In / Providers → **disable new public sign-ups**.
- Confirm a public sign-up attempt is refused **before applying the migration**.
- Authentication → Users → **delete accounts you don't recognise**
  (including `claude-audit-test-account@gmail.com`, left from the July audit).

## 3. Fresh backup immediately before deploy (owner or Claude, CLI)

Supabase's standard backup is three separate dumps — schema alone is NOT a
backup ([docs](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)):

```sh
supabase db dump --db-url "$PROD_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$PROD_DB_URL" -f schema.sql
supabase db dump --db-url "$PROD_DB_URL" -f data.sql --data-only --use-copy
```

Store the three files OUTSIDE this repository (they contain medical data —
never commit them). Note the timestamp. Also note whether PITR is enabled on
the project (Settings → Database → Backups).

## 4. Deploy

Merge `release/sequence-0` → `main`; Lovable deploys. Apply the three new
migrations to production in this order (Lovable/Supabase migration flow or
`supabase db push`):

1. `20260722153000_phase0_security_lockdown.sql`
2. `20260723160000_restrict_medicine_delete.sql`
3. `20260723170000_explicit_table_grants.sql`

## 5. Post-deploy verification — OBSERVATIONAL ONLY

Production gets **no manufactured test data**. Verify by observing:

- [ ] Each caregiver logs in and sees the existing data (Today screen shows
      current medicines; History shows past days).
- [ ] The next *genuine* care action (a real dose logged by whoever is on
      shift) appears across devices — that is the write confirmation.
- [ ] Anonymous access refused: signed-out API request to any table returns
      no rows.
- [ ] Authenticated-but-not-allowlisted refused: create ONE temporary user via
      dashboard invite (sign-ups are disabled), confirm it reads zero rows on
      the tables and storage, then delete it and confirm the deletion in
      Authentication → Users.
- [ ] Recording: verified beforehand on the local stack; in production,
      confirmed by the next real doctor-visit recording.

## If something breaks

See `scripts/emergency/README.md` — allowlist repair first; the backup from
step 3 for catastrophe. Never reach for the policy-reopen script as a first
response.
