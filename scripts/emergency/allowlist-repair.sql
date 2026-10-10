-- ============================================================================
-- Break-glass allowlist repair — PRIMARY recovery for a locked-out caregiver.
-- Bind only a verified family member's existing account. Run each step in
-- the Supabase SQL editor. An email alone grants no access.
-- ============================================================================

-- Step 1: See every real login email that exists in Auth.
select id, email, last_sign_in_at
from auth.users
order by last_sign_in_at desc nulls last;

-- Step 2: See who is currently allowed.
select email, user_id, case when user_id is not null then 'yes' else 'no' end as bound
from public.app_allowlist
order by email;

-- Step 3: Replace the placeholder with the verified caregiver's login email.
-- Create the account in the dashboard first if it does not exist.
-- This ONE statement inserts or binds it. 0 rows affected means that person
-- has no account yet; it does not create an unbound allowlist entry.
insert into public.app_allowlist (email, user_id, note)
select lower(btrim(account.email)), account.id, 'family — bound via repair'
from auth.users as account
where lower(btrim(account.email)) = lower(btrim('REPLACE_WITH_REAL_LOGIN_EMAIL'))
on conflict (email) do update set user_id = excluded.user_id;

-- Step 4: Verify the helper resolves for that identity: the caregiver signs
-- out and back in, and their data appears. (There is no server-side session
-- cache to clear — is_allowed_user() reads the allowlist on every query.)
