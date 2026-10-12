# Local browser checks

Run `npm run test:e2e` with the synthetic local Supabase stack running.
Install the browser once with `npx playwright install chromium`.

For recording and transcription authorization checks, also serve
`transcribe-audio` locally with an env file containing only `OPENAI_API_KEY=`
(empty). Never supply an AI key for these tests. The local runtime must keep
JWT verification enabled. On this Mac, CLI 2.109.1 fails to bootstrap the edge
runtime; `npx --yes supabase@2.120.0 functions serve transcribe-audio --env-file
<path-to-empty-key-env>` works. This command targets the local stack only.
Both browser and isolation commands check for a token-free 401 before creating
test data; if the runtime is unavailable they stop with this start command.

The runner reads keys from `supabase status`, refuses any API other than
`http://127.0.0.1:54321`, and starts its own Vite server on port 5187 with
local-only environment variables. An occupied port fails rather than reusing
another app. It does not change `.env` or use a remote project.

Each test creates unique `@example.local` accounts and synthetic families.
These fixtures remain on the local stack for inspection; no database reset is
performed. Codes come from the local mail catcher on port 54324. Medical data
checks use the signed-in family clients, not the service role. The service role
is used only to create confirmed fixture accounts.

Ten separate tests cover accounts/recovery, invites, medicines, readings,
stays/appointments, isolation, Family & people, and recordings. Chromium uses
a fake microphone. Recording checks cover private storage, retry without a
second upload, account-switch recovery, and sign-out during capture. No AI
request is made: authorization succeeds, then the missing-key error is asserted.
Isolation assertions first
prove that family A can see its fixtures. The removal test advances the browser
clock through the real five-minute refresh interval instead of waiting five
minutes or manually refreshing the page. Resend checks tolerate the local auth
server's resend cooldown; test-level retries are disabled.

Failures save screenshots and traces under `test-results/`; the HTML report is
under `playwright-report/`. Both are ignored by git. Additional sessions also
get screenshots on failure. No external browser requests are allowed, including
font downloads, so tests do not require third-party network access.

# Screen-size audit

`SCREEN_PHASE=before npm run test:screens` captures the baseline; `npm run test:screens`
captures the current UI and builds a before/after contact sheet. This suite is excluded
from `test:e2e`. It uses the same local-only stack guard and browser network block
and creates synthetic data only. Screen artifacts are separate from the normal
runner's `test-results/e2e/` cleanup directory. Outputs are ignored under `test-results/screens/`:
`report.md`, `index.html`, machine-readable `before.json`/`after.json`, and full-page
screenshots by viewport. The 130% pass enlarges all computed fonts (including px
typography) and the root size. Automated findings need visual triage: intentional
truncation and dense calendar/timeline controls are not automatically redesigned.

For a focused pass, use `SCREEN_ONLY=today,medicine-cabinet,medicine-form,dose-sheet,edit-day npm run test:screens`.
It keeps all viewport and text-scale checks, but captures only the named screens.
Selecting `medicine-form` includes top and bottom views of the scrollable form.

## Later

- Calendar cells need a layout redesign to reach 44px on small phones; keep the current cells for now.
- Coverage timeline controls need a redesign to reach 44px; keep the current bars for now.
- Keep intentional subtitle and medicine-row truncation; revisit it only with a layout review.
- Keep two-line History note previews; revisit full-text access in a later design review.
