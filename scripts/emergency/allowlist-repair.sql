-- ============================================================================
-- Break-glass allowlist repair — PRIMARY recovery for a locked-out caregiver.
-- Safe: this only ever ADDS access for a known family member; it cannot widen
-- exposure. Run each step in the Supabase SQL editor.
-- ============================================================================

-- Step 1: See every real login email that exists in Auth.
select id, email, last_sign_in_at
from auth.users
order by last_sign_in_at desc nulls last;

-- Step 2: See who is currently allowed.
select * from public.app_allowlist order by email;

-- Step 3: Compare the two lists. The locked-out caregiver's LOGIN email from
-- step 1 must appear in step 2 EXACTLY (matching is case-insensitive but the
-- allowlist stores what you insert — use lowercase). Add what's missing:
--
-- insert into public.app_allowlist (email, note)
-- values ('their.real.login@gmail.com', 'family — added via repair YYYY-MM-DD')
-- on conflict (email) do nothing;

-- Step 4: Verify the helper resolves for that identity: the caregiver signs
-- out and back in, and their data appears. (There is no server-side session
-- cache to clear — is_allowed_user() reads the allowlist on every query.)
