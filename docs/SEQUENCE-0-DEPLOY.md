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
A mismatch means that person opens an empty app with no error. Fix mismatches
by editing the allowlist insert in
`supabase/migrations/20260722153000_phase0_security_lockdown.sql` **before**
deploying (or plan to run `scripts/emergency/allowlist-repair.sql` right after).

## 2. Dashboard hardening (owner)

- Authentication → Sign In / Providers → **disable new public sign-ups**.
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

Merge `release/sequence-0` → `main`; Lovable deploys. Apply the two new
migrations to production (Lovable/Supabase migration flow or
`supabase db push`).

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
