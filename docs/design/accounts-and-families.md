# Design A: accounts, families and first-time set-up

- **Author:** @leader. **Reviewer and builder:** @coder. **Status:** revision 2, 2026-10-10, after adversarial review (section 14 lists what changed).
- **Owner decisions already made:** hosted product first; existing data is NOT carried over; sign-up happens in our own screens (nobody touches Supabase); **Flow A** (each person has their own email and password); the person who creates the family is the admin and adds people; every add/change/delete is recorded.
- **Screens:** `docs/design/family-setup-screens/` holds the approved mock-ups as HTML (inline styles and exact copy). First screen = `Main.dc.html`.

## 1. Goal

A non-technical person opens the app, creates an account, answers "Who are you caring for?", and is on the Today screen in about two minutes. Each family's data is invisible to every other family, enforced by the database. No dashboard step for any user, ever.

## 2. Not in this design

Payments; more than one cared-for person per family; more than one family per account; roles beyond admin/member; the medicine-record rebuild (Design B, next); notifications and reminder emails; offline; in-app restore of deleted entries; account deletion and export (required before a public launch, section 12).

## 3. Words

- **Household**: one family's private space, for one cared-for person.
- **Member**: a signed-in account that belongs to a household. Role `admin` or `member`.
- **Caregiver**: a name an entry can be credited to. Every member has one. The admin can add name-only caregivers for people without an account (shared tablet, relatives without email).

## 4. Where this lives

- New long-lived branch **`product`**, cut from `release/sequence-0` (commit a5df54e). `main` and `release/sequence-0` stay untouched: Lovable deploys `main` to the family's current app on the old database, and that must keep working.
- The 20 migrations in `supabase/migrations/` were written for the old single-family database and contain the family's emails and medicine list. On `product` they are **removed** and replaced by a clean baseline (section 5). No data migration: there is nothing to keep.
- Database for testing: local stack first, then `myht-staging` (ref `lefqfxkvujqnukgzaviz`), whose schema AND migration history are reset. Never `fvasmrdtzqhswhowlydx`.
- **Remote-target guard.** `config.toml`'s `project_id` is not a safeguard. Any command with `--linked` runs only through `scripts/staging.sh`, which aborts unless `supabase/.temp/project-ref` is exactly `lefqfxkvujqnukgzaviz`, prints the ref, and refuses the old ref by name.
- Also removed on `product`: `app_allowlist`, `is_allowed_user`, `scripts/emergency/`, `docs/SEQUENCE-0-DEPLOY.md`, `supabase/functions/send-reminders/`, the `reminder_settings` table, the Lovable AI gateway branch in `transcribe-audio`.
- `supabase/config.toml`: `project_id = "myht"`; auth settings from section 8.

## 5. Database baseline

Four migration files, in this order, timestamps `20261011000000`–`20261011000300`: schema, security, functions, audit + sync.

### 5.1 New tables

```
households        id uuid pk, care_recipient_name text not null (1..80 after trim),
                  timezone text not null default 'America/Toronto',
                  created_by uuid not null -> auth.users, created_at
household_members household_id -> households on delete cascade,
                  user_id -> auth.users on delete cascade,
                  role text check in ('admin','member'), created_at,
                  primary key (household_id, user_id),
                  UNIQUE (user_id)            -- v1: one household per account; drop when multi-household is designed
caregivers        id uuid pk, household_id -> households on delete cascade,
                  display_name text not null (1..40 after trim),
                  user_id uuid null -> auth.users on delete set null,
                  is_active boolean not null default true, created_at,
                  unique (household_id, id),
                  unique (household_id, user_id) where user_id is not null,
                  unique (household_id, lower(display_name)) where is_active
household_invites id uuid pk, household_id -> households on delete cascade,
                  email text not null (stored lower(btrim())), role text default 'member',
                  caregiver_id uuid null,     -- optional: the name-only caregiver this invite is for
                  composite FK (household_id, caregiver_id) -> caregivers(household_id, id),
                  invited_by uuid not null -> auth.users,
                  created_at, expires_at default now() + interval '14 days',
                  accepted_at, accepted_by, revoked_at,
                  unique (household_id, email) where accepted_at is null and revoked_at is null
audit_log         id bigint identity pk, household_id uuid not null, actor_user_id uuid null,
                  table_name text not null, row_key text not null,
                  action text ('insert','update','delete'),
                  old_row jsonb, new_row jsonb, at timestamptz default now();
                  index (household_id, at desc)
household_sync    household_id uuid pk -> households on delete cascade,
                  table_name text not null, seq bigint not null default 0, at timestamptz
```

### 5.2 Data tables

Same columns and types as today (so UI changes stay mechanical), plus on every one:

- `household_id uuid not null references households(id) on delete restrict`, with an index on `(household_id, date)` where the table has a date.
- Where the table has `recorded_by text`: keep it as the name shown at the time, and add `caregiver_id uuid null` with a composite FK `(household_id, caregiver_id) -> caregivers(household_id, id)`.

Tables: `health_records` (**unique (household_id, date)**), `bp_readings`, `medicines` (unique (household_id, id)), `medicine_logs` (composite FK `(household_id, medicine_id) -> medicines(household_id, id)` ON DELETE RESTRICT), `appointments`, `hospital_stays` (keeps `person_name`, adds `caregiver_id`), `custom_actions` (unique (household_id, id)), `custom_action_logs` (composite FK to `custom_actions`, RESTRICT), `written_notes`, `audio_transcripts` (`audio_url` is replaced by **`audio_path text`**: the storage path, never a URL).

Composite FKs make it impossible for a row in one household to point at a medicine, action or caregiver of another.

### 5.3 Security

- Schema `app_private`, **not** exposed through the API. `GRANT USAGE` to `authenticated` only, and `GRANT EXECUTE` only on the helpers that policies call. It holds:
  - `is_member(hid uuid) returns boolean`, `is_admin(hid uuid) returns boolean`: STABLE, SECURITY DEFINER, `SET search_path = ''`, fully qualified names, reading `public.household_members` for `auth.uid()`.
  - `verified_email() returns text`: the caller's `lower(btrim(email))` from `auth.users` **only if `email_confirmed_at is not null`**, else null. Never trusts an email or metadata supplied by the client.
  - `path_household(name text) returns uuid`: `(storage.foldername(name))[1]` cast to uuid, null on anything that is not a uuid (no error).
  - trigger functions `audit_and_bump()` and `set_updated_at()`.
- RLS enabled on every table. Policies, all `TO authenticated`:
  - data tables: `FOR ALL USING (app_private.is_member(household_id)) WITH CHECK (app_private.is_member(household_id))`
  - `households`: SELECT if member; UPDATE if admin. No INSERT/DELETE policy.
  - `household_members`: SELECT if member of that household. No write policies.
  - `caregivers`: SELECT if member; INSERT and UPDATE if admin. No DELETE (deactivate instead).
  - `household_invites`: SELECT if admin. No write policies.
  - `audit_log`, `household_sync`: SELECT if member. No write policies, no write grants.
- Explicit `GRANT`s to `authenticated` for exactly the operations a policy allows; nothing to `anon`; `REVOKE EXECUTE ... FROM PUBLIC, anon` on every function (hosted Supabase grants `anon` by default, see a5df54e).
- Storage: bucket `audio-files`, private. Object path `<household_id>/<date>/<timestamp>.<ext>`. Policies on `storage.objects` for INSERT, SELECT, DELETE: `bucket_id = 'audio-files' AND app_private.is_member(app_private.path_household(name))`.

### 5.4 Functions the app calls (schema `public`)

All `SET search_path = ''`, executable by `authenticated` only, each one transaction, each raising a short, stable error code in the message that the UI maps to plain words.

**Membership (SECURITY DEFINER)**

| Function | Who | Rules |
|---|---|---|
| `create_household(p_care_recipient_name, p_display_name, p_timezone)` → household id | any verified account | Email must be verified. Creates the household, the admin membership, the caller's caregiver and the `household_sync` row. `UNIQUE (user_id)` on memberships is what stops a second household under concurrency; map that violation to `already_in_household`. |
| `pending_invite()` → 0 or 1 row: invite id, care recipient name, inviter's display name | any verified account | Matches the caller's **verified** email against unexpired, unaccepted, unrevoked invites. Oldest first. |
| `accept_invite(p_invite_id, p_display_name)` → household id | the invited account | `SELECT … FOR UPDATE` on the invite, then re-check: same verified email, not expired, not accepted, not revoked. Adds the membership (the unique constraint serialises create/accept races). Caregiver: if the invite names a `caregiver_id` and that caregiver is still active and has no account, link it; else reactivate the caller's own former caregiver in this household if one exists; else create one. **No linking by matching names.** A display name already used by an active caregiver raises `name_taken`. Marks the invite accepted. |
| `invite_member(p_email, p_caregiver_id default null)` → invite id | admin | Normalises the email. Rejects an email that already belongs to a member of this household. Re-inviting refreshes the expiry instead of duplicating. `p_caregiver_id` must be an active, account-less caregiver of this household. |
| `revoke_invite(p_invite_id)` | admin | `FOR UPDATE` on the invite; no-op error if already accepted. |
| `remove_member(p_user_id)` | admin | Not yourself. Deletes the membership and deactivates that person's caregiver (history keeps the name). |
| `household_people()` → rows: caregiver id, display name, is_active, user_id, role, email | member | The ONLY way member emails are read. Returns the caller's own household only; never exposes `auth.users`. |

**Readings (SECURITY INVOKER, so RLS applies)**

| Function | Rules |
|---|---|
| `log_reading(p_household_id, p_date, p_feed_bags default 0, p_bile_bags default 0, p_stool_count default 0, p_vomit_count default 0, p_urine_count default 0, p_flush_ml default 0, p_flush_count default 0, p_weight default null, p_caregiver_id, p_recorded_by)` → the day row | ONE statement: `INSERT … ON CONFLICT (household_id, date) DO UPDATE` that ADDS each delta to the stored value, clamps at 0, sets `weight` only when given, and sets `vomiting` / `stool_passed` from the new total only when that delta is non-zero. No read-then-write in the client. |
| `log_bp_reading(p_household_id, p_date, p_systolic, p_diastolic, p_caregiver_id, p_recorded_by)` → the reading row | Takes `pg_advisory_xact_lock` on (household, date), inserts the reading, then upserts the day's average computed from `bp_readings` in the same transaction. |

Name-only caregivers are plain inserts/updates by the admin under RLS. Reading "my household" is a plain select under RLS. The day editor keeps its own path: it updates only the fields the caregiver changed (it sets values, it does not add); for a day with no row it inserts and, on a unique violation, updates those same changed fields.

### 5.5 Audit and live updates

- One hardened SECURITY DEFINER trigger function `app_private.audit_and_bump()`, `AFTER INSERT OR UPDATE OR DELETE … FOR EACH ROW`, on every data table and on `households`, `household_members`, `caregivers`, `household_invites`. Working from `to_jsonb(coalesce(NEW, OLD))`:
  - household = the row's `household_id`, or its `id` when the table is `households`;
  - `row_key` = the row's `id`, or `household_id:user_id` for `household_members`;
  - writes one `audit_log` row (`auth.uid()` as actor, table, key, action, old and new row);
  - upserts `household_sync` for that household with the table name and `seq + 1`.
- **Live updates never carry data rows.** The realtime publication contains ONLY `household_sync`. A client subscribes to that one table; RLS lets it receive only its own household's row; each event says "table X changed", and the client invalidates that table's queries through the existing batcher. This is deliberate: Postgres Changes cannot authorise DELETE events with RLS and they cannot be filtered, so publishing data tables would leak another family's activity to any subscriber who drops the filter.
- `set_updated_at()` on `health_records`.
- Deletes stay hard deletes in v1; the deleted row is kept in `audit_log.old_row`. In-app restore is a later feature.

## 6. Sign-up and sign-in (Flow A)

1. **Create account**: name, email, password (min 8). `auth.signUp` with the name in user metadata. Confirmation is a **6-digit code typed into the app**: `auth.verifyOtp({ email, token, type: 'email' })`. "Send the code again": `auth.resend({ type: 'signup', email })`.
2. **After sign-in** the app resolves, in this order: already a member → app; `pending_invite()` returns a row → **Join** screen → `accept_invite`; otherwise → **Who are you caring for?** → `create_household` → **Who else helps?** → Today. A failed lookup shows an error with Retry; it never falls through to onboarding.
3. **Sign in**: email + password. **Forgot password**: `resetPasswordForEmail`, then code + new password with `verifyOtp({ type: 'recovery' })` and `updateUser`. "Send again" repeats `resetPasswordForEmail`.
4. **Inviting**: the admin types an email (optionally for an existing name-only person). v1 sends no email from us: the screen shows a ready-made message with the app address and a Share button (system share sheet, WhatsApp). The invited person creates their own account with that email and lands in the family. Email ownership is proven by the confirmation code, which is why `verified_email()` is checked server-side.
5. `signUp` for an email that already has an account may return a fake success OR an error, depending on project settings. Handle both: never promise that a code was sent, and always offer "Sign in instead" and "Forgot password" on the code screen.

## 7. App changes

- **`HouseholdProvider`** under the auth gate: loads my membership, the household and its people. States: loading, **error (Retry)**, no household (onboarding), ready. Provides `householdId`, `role`, `careRecipientName`, `caregivers`, `myCaregiver`.
- **Every hook**: selects add `.eq('household_id', householdId)`, inserts send `household_id`, query keys start with `['household', householdId, …]`. RLS stays the real boundary; the filters are for cache correctness and speed. Do this **one domain at a time** (medicines, readings, appointments, stays, notes, custom actions, transcripts), each with its tests, and do not run a build with only some hooks scoped against shared data.
- **Readings** go through `log_reading` / `log_bp_reading`. The client no longer reads a day row in order to add to it.
- **Live updates**: `useRealtimeSync` subscribes to `household_sync` only and maps `table_name` to query keys.
- **Who is logging**: `RECORDER_OPTIONS` and `STAY_PEOPLE` are deleted. Pickers list active caregivers; the default is my own caregiver, remembered per device as a caregiver id. Writes send `caregiver_id` and `recorded_by` (the name).
- **Names**: page title "Health Tracker"; PDFs and the More shelf use `careRecipientName`. No personal names, emails or medicines anywhere in the repo's live code or seed.
- **Removed**: the "not approved" screen (onboarding replaces it) and the allowlist check.
- **Family & people** screen under More: people with an account (name, email, role), pending invites (Share, Cancel), name-only people (Add, Deactivate, "Invite them" = an invite linked to that caregiver), Remove member, Invite someone.
- **Recording identity boundary.** `RecordingProvider` moves inside the household-ready subtree and is keyed by `userId:householdId`, so a change of identity remounts it with empty in-memory state. Every job pins `user_id` and `household_id` when it is created; upload, transcription and save each re-check the pinned pair against the current session and stop with a clear message on mismatch; the IndexedDB slot is keyed by the pair and recovery only loads a matching job. If the provider unmounts while recording, it stops the recorder and persists what was captured under the pinned identity. Storage path as in 5.3; store `audio_path`.
- **`transcribe-audio`**: `verify_jwt = true`; download the file with the **caller's** client so storage RLS decides access; no service-role key in the function; OpenAI only.
- **Types**: regenerate `src/integrations/supabase/types.ts` from the local stack and drop the `as any` casts that the old types forced.

## 8. Auth settings (local `config.toml`; hosted settings are set once by the owner)

Sign-ups on. Email confirmation on. OTP length 6. Minimum password length 8. Confirmation and recovery email templates show the code. Hosted projects need custom SMTP before real addresses receive mail (the built-in sender only reaches the project's own team and allows about two messages an hour); locally all mail lands in the mail catcher on port 54324.

## 9. Tests that must pass before a second family is ever invited

`scripts/test/tenant-isolation.sh` refuses to run unless the API is `127.0.0.1`. It builds two families, A and B, with an admin and a member each, and asserts:

**Isolation**
1. B's member reads 0 rows from every table of A, by id and by filter, including `audit_log` and `household_sync`.
2. B's member cannot insert, update or delete with A's `household_id`, directly or through `log_reading` / `log_bp_reading`.
3. B's member cannot read, upload to or delete in A's storage folder; a malformed path (no folder, non-uuid folder, `..`) is refused without an error leak.
4. `transcribe-audio` called by B with a path in A's folder fails without returning content.
5. A `medicine_logs` row cannot reference another household's medicine, and no row can reference another household's caregiver.
6. `anon` can read nothing and execute nothing; no function in `app_private` is callable through the API.

**Roles inside one family**
7. A's member (not admin) cannot `invite_member`, `revoke_invite`, `remove_member`, insert or update `caregivers`, or update `households`.
8. B's admin cannot do any of those against A.
9. A removed member loses access on the next request.

**Accounts and invites**
10. An account whose email is NOT verified cannot `create_household` or `accept_invite`.
11. A stranger who signs up with an invited email but has not verified it gets nothing; after verifying, exactly that household and only that one.
12. A revoked or expired invite cannot be accepted. `household_people()` returns only the caller's household.

**Concurrency** (run each at least 20 times in parallel)
13. Two `create_household` calls by one account: exactly one household and one membership.
14. `create_household` racing `accept_invite` for one account: exactly one membership.
15. `accept_invite` racing `revoke_invite`: one wins cleanly; never an accepted-and-revoked invite, never a membership from a revoked invite.
16. Two caregivers each `log_reading` one feed at the same moment, on a day with a row and on a day without one: the total rises by exactly two and there is exactly one row.
17. Two concurrent `log_bp_reading` calls: both readings exist and the stored average equals the average of all readings.

**Audit and live updates**
18. Insert, update and delete on a data table each write one `audit_log` row with the right actor and key; so do `create_household`, `accept_invite` and `remove_member`. A client cannot insert, change or delete audit rows.
19. Hostile subscription: B subscribes, with NO filter, to every table and to `household_sync`, while A inserts, updates, deletes and removes a member. B receives zero events. Assert on the payloads received, not on the UI.

Plus unit tests, tsc and build, a recording test (A has a pending job, signs out, B signs in on the same device: B sees no job, nothing uploads under B, A recovers it after signing back in), and an end-to-end browser pass of sections 6 and 7 by @leader on the local stack.

## 10. Build rounds

- **A0** branch `product`; commit this document and the screens.
- **A1** database baseline, `config.toml`, synthetic seed, `scripts/staging.sh`, isolation script (tests 1–3, 5–18; 4 and 19 land with A5 and A3). @leader runs it.
- **A2** auth screens, `HouseholdProvider`, onboarding and join.
- **A3** household scoping, one domain per sub-round (A3a medicines, A3b readings via the two functions, A3c appointments + stays, A3d notes + custom actions + transcripts list), caregivers in every picker, names in title and PDFs, the `household_sync` subscription and test 19.
- **A4** Family & people screen.
- **A5** recording identity boundary, storage path, `transcribe-audio`, test 4 and the recording test. **Must be finished before any multi-family testing.**
- Then: reset and push `myht-staging` through `scripts/staging.sh`, owner sets SMTP and the OpenAI key, end-to-end check there. No intermediate build is deployed anywhere shared.

## 11. Known limits accepted for v1

- Deleting a household currently fails at commit because the deferred ticker insert follows its cascade deletion; handle this with account deletion in section 12.

- One household per account and one cared-for person per household.
- If the only admin's account is deleted, the household has no admin. Needs "make someone else admin" before launch.
- Dates are the device's local dates; `households.timezone` is stored for later server-side use.
- Invites are shared by message, not emailed by us.
- Deletes are permanent in the app; the audit log keeps the deleted row for support.

## 12. Before any public launch (not this design)

Privacy policy and terms; consent for sending recordings to OpenAI; account deletion and data export; sign-up abuse protection (CAPTCHA, rate limits); backups on a paid plan; admin transfer; in-app restore; the medicine-record rebuild (Design B).

## 13. Reviewer's answers to the original questions

Clean baseline: yes, the simplest path. Tokenless invites: sound with the server checks and row locks above. `recorded_by` + `caregiver_id`: keep both. Audit: stays in A1 so onboarding and membership changes are audited from the first build.

## 14. What changed after the adversarial review (2026-10-10)

| Finding | Change |
|---|---|
| "Retry once as update" still loses concurrent readings | Readings are atomic database functions (`log_reading`, `log_bp_reading`); the client retry is gone. Concurrency tests 16–17. |
| Realtime filters are not a security boundary; DELETE events bypass RLS | No data table is published. Only the per-household `household_sync` ticker is. Hostile-subscription test 19. |
| Recording state survives a change of identity | Provider scoped and keyed by user + household; jobs pin their identity; checks before every step; recovery only for a match. Recording test. |
| One-household rule was check-then-insert | `UNIQUE (user_id)` on memberships; invite rows locked on accept and revoke. Tests 13–15. |
| Generic audit trigger could not represent `households` or composite keys | `row_key text`, table-specific household mapping, explicit hardened definer trigger. Test 18 covers membership operations. |
| Linking a name-only caregiver by matching names | Removed. An invite may name the caregiver it is for; otherwise a new caregiver is created. |
| Member emails had no read path | `household_people()`. |
| Provider could mistake a failed lookup for "no household" | Error state with Retry. |
| OTP types, resend, existing-email sign-up, SMTP limits | Corrected in sections 6 and 8. |
| `config.toml` is not a remote-target guard | `scripts/staging.sh` with an exact-ref check. |
| A3 too large | Split into A3a–A3d; no partially scoped build is deployed. |
