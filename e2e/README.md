# Local browser checks

Run `npm run test:e2e` with the synthetic local Supabase stack running.
Install the browser once with `npx playwright install chromium`.

The runner reads keys from `supabase status`, refuses any API other than
`http://127.0.0.1:54321`, and starts its own Vite server on port 5187 with
local-only environment variables. An occupied port fails rather than reusing
another app. It does not change `.env` or use a remote project.

Each test creates unique `@example.local` accounts and synthetic families.
These fixtures remain on the local stack for inspection; no database reset is
performed. Codes come from the local mail catcher on port 54324. Medical data
checks use the signed-in family clients, not the service role. The service role
is used only to create confirmed fixture accounts.

Eight separate tests cover accounts/recovery, invites, medicines, readings,
stays/appointments, isolation and Family & people. Isolation assertions first
prove that family A can see its fixtures. The removal test advances the browser
clock through the real five-minute refresh interval instead of waiting five
minutes or manually refreshing the page. Resend checks tolerate the local auth
server's resend cooldown; test-level retries are disabled.

Failures save screenshots and traces under `test-results/`; the HTML report is
under `playwright-report/`. Both are ignored by git. Additional sessions also
get screenshots on failure. No external browser requests are allowed, including
font downloads, so tests do not require third-party network access.
