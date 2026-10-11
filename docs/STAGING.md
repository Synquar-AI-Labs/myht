# First staging check

Preparation only. Nothing below authorizes a remote operation: wait for the
owner's explicit approval. Target: `myht-staging`, organization `myht`, ref
`lefqfxkvujqnukgzaviz`. NEVER use `fvasmrdtzqhswhowlydx` (the live Lovable app).
Use synthetic data only. Stay on `product`; do not push, merge or deploy the app.
Stop on a different ref, password/login prompt, unexpected error, paid change,
or any data that the owner has not approved discarding.

## Parked email state — owner's decision, 2026-10-10

Custom SMTP and the sign-in settings push are deferred. The staging-only plan
while parked is "Confirm email" OFF, changed in the dashboard only after the
owner explicitly approves that switch; coder does not change it. This document
does not claim the switch has already been changed. Our committed config keeps
confirmations ON as the intended final state; do not push it while parked.

The six-digit confirmation-code step, forgot-password flow and verified-invite
flow are not usable in this parked state. Staging is for the owner alone; do
not share its address or key with anyone else. Starting the local preview does
not authorize sign-up, sign-in or test-data creation.

Before ANY other person uses staging, and before production: the owner configures
custom SMTP, turns "Confirm email" back ON, then settings are pushed through
preview → leader reads the full diff → approved apply. Finally verify sign-up
and its code, password recovery, and verified invites end-to-end. Until that
gate passes, the email-dependent setup is not ready for other users.

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
```

Expected: the wrapper prints the staging ref and shows the 20 legacy remote
versions and five new local versions. Leader checks filenames. For this first
baseline replacement, `db push --linked --dry-run` refuses because the legacy
remote versions are deliberately absent locally; it does not list five pending
migrations. Do not repair history or pull the old schema. The approved reset
in step 4 clears history before applying the baseline. Keep push dry-runs for
later additive migrations only. Undo: nothing has been changed. Stop if history
differs from the expected legacy baseline.

## 4. Replace the legacy staging baseline — coder, owner-approved destructive step

```sh
STAGING_CONFIRM=lefqfxkvujqnukgzaviz scripts/staging.sh db reset --linked
scripts/staging.sh migration list --linked
```

Expected: the staging ref is printed; the wrapper adds global `--yes` ONLY for
this approved reset, so it does not wait for an interactive answer. Without
`--yes`, non-terminal EOF means no and the CLI cancels the reset. Then all
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

## 5. Configure custom SMTP before settings push — owner only

The first staging settings push returned HTTP 400 with this exact message:

```text
Email template modification is not available for free tier projects using the default email provider. Please upgrade your plan or configure a custom SMTP provider.
```

The no-apply preview afterward still showed all intended Auth changes pending.
Code templates are required by our signup/recovery screens. On this Free
project, the owner must configure a verified sender/provider in Dashboard →
Authentication → Email → SMTP Settings BEFORE the settings push. A paid plan
is the platform's other option, not authorized by this runbook. Stop until
the owner has approved and completed SMTP setup; coder never enters credentials.

Our config file must NEVER contain an `[auth.email.smtp]` block, including
under `[remotes.staging]`, or SMTP credentials. In CLI 2.109.1, absent SMTP
preserves dashboard connection settings/credentials: `authSubsetFromConfig`
sets SMTP undefined; `authToUpdateBody` emits no SMTP fields. A present block
with `enabled = false` instead sends `smtp_host = ""`, disabling it. The
separate email `max_frequency` still updates `smtp_max_frequency`; preserve
its hosted value too. Re-audit on CLI upgrades.

Expected: owner confirms SMTP is configured; leader verifies non-secret
settings. Undo: owner removes/revokes SMTP credentials in the dashboard and
settings push remains blocked. After step 6, verify sign-up/recovery delivery
to non-team synthetic addresses before invitations.

## 6. Preview, review, then push hosted settings — coder and leader

Use CLI 2.109.1 for this source-audited procedure; re-audit before upgrading it.
After remote approval, first run:

```sh
scripts/staging.sh config preview
```

This invokes config push with `--agent no --output-format text --yes=false`
and an unlimited stream of `n` answers. It shows the full diff but refuses
EVERY update and paid-feature prompt. Explicit `--yes=false` overrides even
`SUPABASE_YES` in the shell or `supabase/.env`. It is not a CLI dry-run flag:
config push has none. Never substitute `/dev/null`: empty input defaults to
YES for config push; JSON/stream-json output also takes that default without
asking. `--agent yes` (or detected agents in auto mode) defaults output to JSON;
`--agent no` disables that detection, and explicit text output wins.

Leader reads the ENTIRE preview. Stop on unrelated or paid changes. For each
omitted setting that differs, copy its current non-secret hosted value into
the matching `[remotes.staging]` section to preserve it; preview again. Do not
apply until only the intended URL, sign-up, password and code-template changes
remain and step 5 is complete. The staging preview identified TOTP enrollment
and verification as true and email cooldown as 60 seconds; those hosted values
are now pinned in the remote block only. Omission of other rate limits is NOT
a promise to retain hosted defaults; inspect every fresh preview.

Only AFTER leader approves that full diff:

```sh
STAGING_CONFIRM=lefqfxkvujqnukgzaviz scripts/staging.sh config push
```

Expected: target is staging and `Loading config override: [remotes.staging]`.
With terminal input, answer only for the approved sections. Without terminal
input, an unanswered prompt defaults to YES and applies; the confirmation
environment variable authorizes this form, not the preview. Dashboard →
Authentication → URL Configuration, Sign In / Providers →
Email, and Email Templates: verify localhost port 5188, sign-ups enabled,
confirmation required, six-digit codes, minimum password eight, and both code
templates. Verify the preserved settings too.

Undo: record the previous non-secret values before pushing and restore them in
staging's dashboard or in this remote block followed by another approved push.
Do not restore the old allowlist architecture.

The [CLI push source](https://github.com/supabase/cli/blob/v2.109.1/apps/cli/src/legacy/commands/config/push/push.handler.ts)
loads config with the resolved project ref, merges the matching remote before
decode, and prints the override name. This is consistent with Supabase's
[remote configuration docs](https://supabase.com/docs/guides/deployment/branching/configuration).
No remote config command was used to verify it during preparation.

### Omitted-setting write surface (CLI 2.109.1)

These sections are decoded with defaults and can be overwritten if their
section's push is accepted. Inspect and preserve actual hosted values first:

- API: exposed schemas (`public,graphql_public`), extra search path
  (`public,extensions`), max rows (1000). Local API port/TLS/external URL are
  not sent to the hosted API.
- Storage: global file-size limit (50 MiB). Absent image-transformation and
  S3 blocks are preserved; disabled analytics does not send an enable/disable
  update. Vector storage defaults to ENABLED in this CLI: our remote override
  explicitly sets `storage.vector.enabled = false` so it emits no vector
  update (and does not disable any already-hosted vector feature). This is
  the one source-proven preservation pin added now. Bucket declarations are
  not pushed by this command.
- Auth root: JWT expiry (3600), refresh rotation (true), reuse interval (10),
  manual linking (false), anonymous sign-in (false), password requirements
  (empty), plus our explicitly configured URL/sign-up/minimum password.
- Auth rate limits: anonymous users 30, refresh 150, sign-in/sign-up 30,
  verification 30, SMS 30, Web3 30. Email rate is NOT sent without an enabled
  SMTP block. These are CLI defaults, not verified hosted defaults.
- Auth MFA: TOTP, phone and WebAuthn enroll/verify default false; maximum
  factors 10; phone OTP length 6, template `Your code is {{ .Code }}`,
  frequency 5s. Auth sessions: timebox and inactivity timeout default empty
  (unlimited), so absence can remove hosted restrictions.
- Auth email: double-confirm changes true, secure password change false,
  frequency 1s, OTP expiry 3600, plus our signup/confirmation/length/templates.
- Auth SMS: signup/confirmation false, frequency 5s, default code template;
  absent provider credentials/test OTP are not cleared. Auth Web3 Ethereum
  and Solana default disabled.

Preserved when absent: DB settings (empty update body; not defaults), DB SSL
enforcement, disabled network restrictions, Auth captcha, each hook, SMTP,
external providers, unspecified email templates/notifications. Auth passkey
and standalone WebAuthn are undefined in this CLI mapping; OAuth server and
third-party blocks are not emitted by `authToUpdateBody`. Local DB version,
pooler/ports and analytics configuration are not hosted changes here.

Source functions under `apps/cli/src/legacy/commands/config/push/config-sync/`:
`apiSubsetFromConfig` / `apiToUpdateBody` (api.sync.ts),
`dbSettingsToUpdateBody` (db.sync.ts), `storageToUpdateBody` (storage.sync.ts),
`authSubsetFromConfig` / `authToUpdateBody` (auth.sync.ts).
`push.raw-presence.ts` checks whether optional blocks actually exist before
using their decoded defaults. Defaults are in `packages/config/src/`.
`legacyConfigPush` gates every remote update through `keep()`;
`legacyPromptYesNo` is in `legacy/shared/legacy-prompt-yes-no.ts`.
Global precedence is `legacyResolveYesWithProjectEnv` in
`apps/cli/src/shared/legacy/global-flags.ts`; agent JSON selection is
`resolveAgentOutputFormat` in `apps/cli/src/shared/cli/agent-output.ts`.
Reset delegates to `resetRemote` in
`apps/cli-go/internal/db/reset/reset.go`, whose `Console.PromptYesNo`
(`apps/cli-go/internal/utils/console.go`) has a false default for reset.

## 7. Deploy the staging function without a key — coder

```sh
STAGING_CONFIRM=lefqfxkvujqnukgzaviz scripts/staging.sh functions deploy transcribe-audio --use-api
scripts/staging.sh secrets list
```

`--use-api` bundles server-side without Docker. The installed CLI 2.109.1's
local Docker bundler failed with a missing `output.eszip`; this avoids that
bundler, not JWT checks. Stop if server-side deployment fails; do not try
another deployment route without approval.

Expected: only `transcribe-audio` is deployed to staging, JWT verification stays
enabled, and the secret inventory exposes names/digests, not values. Leader
checks Edge Functions → transcribe-audio. An authorized call without an AI key
returns `transcription_not_configured`; foreign/malformed storage paths receive
the generic refusal. Do not make paid calls yet.

Undo: delete this staging function in the dashboard (owner), or redeploy a
reviewed prior version to staging after approval. The app still records and
keeps audio when transcription is not configured.

## 8. Staging browser preview — leader supplies public values; coder runs it

After approval, leader can read the staging URL and publishable key through the
read-only Supabase connection and hand these PUBLIC values to coder for the
ignored `.env.staging.local`. Alternative: owner copies them from Dashboard →
staging Project Settings → API Keys. Never use a secret/service
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

## 9. Paid transcription enablement — owner only, separately approved

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

## 10. Before real hosting/invites — owner and leader

Choose the hosting URL, then update BOTH `site_url` and
`additional_redirect_urls` in `[remotes.staging.auth]` and run another approved
config preview, leader review, then approved config push. Retain the owner-managed
SMTP from step 5 and confirmations; verify sign-up/recovery delivery to non-team
synthetic addresses. Before every later push, check there are no SMTP changes
and repeat the whole hosted-value preservation review from step 6. Never add
an `[auth.email.smtp]` block or credentials to this file.
Expected: exact hosted redirects and working email; leader verifies before
inviting people. Undo: stop invitations/preview, restore prior staging URL
settings, and remove/revoke the new SMTP credentials through the owner.
