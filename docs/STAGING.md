# First staging check

Preparation only. Nothing below authorizes a remote operation: wait for the
owner's explicit approval. Target: `myht-staging`, organization `myht`, ref
`lefqfxkvujqnukgzaviz`. NEVER use `fvasmrdtzqhswhowlydx` (the live Lovable app).
Use synthetic data only. Stay on `product`; do not push, merge or deploy the app.
Stop on a different ref, password/login prompt, unexpected error, paid change,
or any data that the owner has not approved discarding.

## 1. Local clean-build gate — coder, leader verifies

From the repository, run:

```sh
supabase db reset --local
npx tsc --noEmit
npx tsc -p tsconfig.app.json --noEmit
npx vitest run
npm run build
scripts/test/tenant-isolation.sh
npm run test:e2e
```

The recording suites require the local function runtime, with JWT verification
and an env file containing only an empty `OPENAI_API_KEY=`:

```sh
npx --yes supabase@2.120.0 functions serve transcribe-audio --env-file <path-to-empty-key-env>
```

Expected: five migrations apply from nothing, TypeScript is clean, unit/build
checks pass, isolation has 25 PASS and zero failures, and all 10 browser tests
pass. Leader reviews the output. Undo: repeat the local reset (synthetic data
only); stop the test server/runtime with Ctrl+C. No remote test fixtures.

## 2. Approval and disposable-target check — owner

Dashboard → organization `myht` → project `myht-staging`; confirm its URL contains
`lefqfxkvujqnukgzaviz`. Confirm the project may be reset and contains no records
that must be retained. Its last verified state was the legacy single-family
schema with zero users; do not assume that is still true. If anything needs
keeping, STOP and arrange a verified backup before approving reset.

Expected: explicit approval to replace staging's legacy schema. Leader records
that approval. Undo: withdraw approval before execution. Reset cannot undo lost
data without a backup; this is why disposability is checked first.

## 3. Confirm the local link and preview — coder, after approval only

Read `supabase/.temp/project-ref` locally; it must be the staging ref. If absent
or wrong, STOP: owner/leader must approve an explicit staging link separately.
The wrapper rejects the live ref, other refs, target overrides and unlisted
commands. Do not bypass it.

```sh
scripts/staging.sh migration list --linked
scripts/staging.sh db push --linked --dry-run
```

Expected: the wrapper prints the staging ref; remote history is shown and the
five new migrations are pending. Leader checks filenames. A dry-run does not
prove the new baseline can be pushed over existing tables. Undo: nothing has
been changed. Stop if history differs from the expected legacy baseline.

## 4. Replace the legacy staging baseline — coder, owner-approved destructive step

```sh
STAGING_CONFIRM=lefqfxkvujqnukgzaviz scripts/staging.sh db reset --linked
scripts/staging.sh migration list --linked
```

Expected: the staging ref is printed, confirm the CLI's reset prompt, then all
five `20261011000000` through `20261011000400` migrations apply; local and remote
history agree. Leader verifies the new RLS, private storage, ticker and quota
function in staging, and no users/data were seeded. Do not run the local-only
isolation script against staging. Undo: restore an approved staging backup if
needed, or repeat the clean staging reset after renewed approval. Never reopen
policies or use the live database as a fallback.

For later additive migrations, use `db push --linked --dry-run`, review it, then
`STAGING_CONFIRM=lefqfxkvujqnukgzaviz scripts/staging.sh db push --linked`.
The first clean-baseline reset already applies the migrations; no redundant
push is needed.

## 5. Push hosted Auth settings — coder; leader checks the dashboard

```sh
STAGING_CONFIRM=lefqfxkvujqnukgzaviz scripts/staging.sh config push
```

Expected: target is staging and `Loading config override: [remotes.staging]`.
Review the planned diff before confirming; stop on unrelated, rate-limit or paid
changes. Dashboard → Authentication → URL Configuration, Sign In / Providers →
Email, and Email Templates: verify localhost port 5188, sign-ups enabled,
confirmation required, six-digit codes, minimum password eight, and both code
templates. Hosted rate limits are not overridden in our file.

Undo: record the previous non-secret values before pushing and restore them in
staging's dashboard or in this remote block followed by another approved push.
Do not restore the old allowlist architecture.

The [CLI push source](https://github.com/supabase/cli/blob/develop/apps/cli/src/commands/config/push/push.handler.ts)
loads config with the resolved project ref, merges the matching remote before
decode, and prints the override name. This is consistent with Supabase's
[remote configuration docs](https://supabase.com/docs/guides/deployment/branching/configuration).
No remote config command was used to verify it during preparation.

## 6. Deploy the staging function without a key — coder

```sh
STAGING_CONFIRM=lefqfxkvujqnukgzaviz scripts/staging.sh functions deploy transcribe-audio
scripts/staging.sh secrets list
```

Expected: only `transcribe-audio` is deployed to staging, JWT verification stays
enabled, and the secret inventory exposes names/digests, not values. Leader
checks Edge Functions → transcribe-audio. An authorized call without an AI key
returns `transcription_not_configured`; foreign/malformed storage paths receive
the generic refusal. Do not make paid calls yet.

Undo: delete this staging function in the dashboard (owner), or redeploy a
reviewed prior version to staging after approval. The app still records and
keeps audio when transcription is not configured.

## 7. Staging browser preview — owner fills placeholders; coder runs it

Dashboard → staging Project Settings → API Keys: owner copies only the staging
publishable key into the ignored `.env.staging.local`. Never use a secret/service
role key, and do not change `.env`. The placeholder file is:

```dotenv
VITE_SUPABASE_URL=https://lefqfxkvujqnukgzaviz.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=REPLACE_WITH_STAGING_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID=lefqfxkvujqnukgzaviz
```

```sh
npm run dev:staging
```

Expected: http://localhost:5188; occupied ports, live/wrong URLs and placeholder
keys refuse startup. Verify browser requests use the staging host only. Leader
checks sign-up → code → family setup and synthetic reads/writes. The first
sign-up MUST use the owner's Supabase email, which is on the organization's
team. Supabase's [built-in SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
only sends to that team's addresses and has a low shared delivery quota (currently
two emails per hour). Do not invite arbitrary family emails until custom SMTP
is configured. Undo: Ctrl+C, remove the local key; staging data remains isolated.

## 8. Paid transcription enablement — owner only, separately approved

OpenAI Platform → Project settings → Limits → Spend → Edit spend limit: set the
owner's monthly budget and alert thresholds; enable a hard limit if the owner
wants traffic stopped at that amount. Verify the saved project and amount.
Alerts alone do not stop requests, and hard-limit propagation can allow a small
overshoot; see the [official spend-limit guidance](https://developers.openai.com/api/docs/guides/spend-limits).
Then staging Dashboard → Edge Functions → Secrets → add `OPENAI_API_KEY`.
The owner enters it directly; nobody copies it into the repo, terminal, frontend
or reports. The app's 20-attempt rolling quota is separate from the monthly budget.

Expected: key name appears, and only a separately authorized synthetic audio test
is transcribed. Leader verifies the private path, transcript and attribution.
Undo: owner removes the staging secret and revokes the OpenAI key; recording and
Retry remain available. Coder's automated tests never use an AI key or call.

## 9. Before real hosting/invites — owner and leader

Choose the hosting URL, then update BOTH `site_url` and
`additional_redirect_urls` in `[remotes.staging.auth]` and run another approved
config push. Configure Authentication → Email → SMTP Settings for a verified
sender/provider; retain confirmations and verify sign-up/recovery delivery to
non-team synthetic addresses. Do not add SMTP credentials to this file.
Expected: exact hosted redirects and working email; leader verifies before
inviting people. Undo: stop invitations/preview, restore prior staging URL
settings, and remove/revoke the new SMTP credentials through the owner.
