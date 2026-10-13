# Native shell checks

Everything is built locally. These commands do not deploy the app or change a
database. The website build and hosting scripts remain separate.

## Builds

`npm run app:build:staging` builds and scans two native artifacts, runs the static
staging check with external requests blocked, and copies them into iOS/Android.
It reads only the public values in the ignored `.env.staging.local`. The native
invite address is `https://myht-staging.pages.dev`. This is the only target for
an eventual real device.

`npm run app:build:local` reads the public key from `supabase status` and refuses
anything except the local stack. iOS uses `http://127.0.0.1:54321`; Android uses
`http://10.0.2.2:54321`. Both load bundled screens, not a remote web page. The
invite address is the local browser harness at `http://127.0.0.1:5187`.

Asset builds keep the tracked iOS and Android configuration clean. The local
simulator/emulator compiler adds its transport allowance only during compilation
and strips it in a `finally`, even when compilation fails. Staging refuses an
allowance. A failed asset build removes the build receipt. Outputs are ignored
`dist-native-<target>-<platform>/`, never `dist-staging/`, and cannot be uploaded
through the website's hosting guard. Do not copy local native builds to devices.

`npm run app:ios` compiles for the iOS simulator only, with signing disabled,
after scanning the copied native artifact. Output is under
`test-results/native/DerivedData/Build/Products/Debug-iphonesimulator/App.app`.
It never selects an Apple team or requests device provisioning.

`npm run app:android` opens the generated Android project. SDK setup, licence
acceptance, builds and emulator/device checks are deferred until separately
approved. Android Studio includes its own Java runtime.

`npm run app:android:build` uses Homebrew `openjdk@21` through `JAVA_HOME` in that child
process only. It does not change the shell's default Java or upgrade Gradle.
The approved SDK is at `~/Library/Android/sdk` (or set `ANDROID_HOME`).

## TestFlight (owner)

The owner completes Apple Developer enrolment, adds the Apple account in Xcode,
and uses the Apple account in Xcode for the distribution export.
No account credentials or team id belong in tracked files.

After `npm run app:build:staging`, the owner sets `IOS_TEAM_ID` in the terminal
and runs `npm run app:ios:archive`. This creates an unsigned Release archive at
`test-results/native/App.xcarchive`; build number is the current Git commit count.
Marketing version remains the project's version.

Next run `npm run app:ios:export`. Automatic signing uses the team's distribution
profile without requiring a registered device. Output is `test-results/native/export`.
The script unzips the IPA and checks its staging assets, encryption declaration
and absence of a server block or local transport allowance, then records the
commit and artifact hashes in an ignored verification receipt.

The owner creates the app entry in App Store Connect with bundle id
`com.fahadakbar.myht`, then runs
`TESTFLIGHT_CONFIRM=com.fahadakbar.myht npm run app:ios:upload`.
Upload refuses a missing/stale export or changed IPA/archive and re-checks the IPA.
All three commands check staging assets. Export/upload use temporary, automatically
removed options plists outside the repository. None runs in tests.
In App Store Connect, the owner finishes TestFlight processing/compliance and
adds the tester; the iPhone installs it through Apple's TestFlight app.

`node scripts/native-assets.mjs` regenerates the code-drawn placeholder icons
and splash images locally, with all browser network requests blocked.

## Device checklist (owner, after signing/licence approval)

- Install the **staging** target. Check that the first screen has the same
  fonts and cream background, and no controls collide with the notch/home bar.
- Sign in, close/reopen, and confirm the session remains. Sign out and confirm
  the old family's data disappears.
- Open Today, the medicine cabinet and the photo screen. Open a bottom sheet,
  focus its lowest field, and check the keyboard does not cover it.
- Take one synthetic prescription photo and choose one from the photo picker.
  Check both buttons, preview zoom, and the filled medicine form.
- Record two minutes of synthetic speech while keeping the phone unlocked.
  Stop, interrupt the upload by going offline, reconnect and retry. Force-close
  with a **stopped, pending** recording and verify recovery under the same
  identity only. The existing recorder holds active chunks in memory: killing
  the process before Stop is not covered by this recovery check.
- Save recovered audio and each PDF report through the system share sheet.
  Open the resulting files and check their content. Share an invite and check
  it contains the website address, never `capacitor://localhost`.
- Android Back: close the top sheet first, then the detail screen, then return
  to Today; at Today background the app. Check busy forms are not navigated away.
- If wake lock does not work, record the result before considering a plugin.
  Background recording and notifications are not implemented in this shell.

Use fictional local data for developer tests. Staging is still owner-only
while email confirmation is off. No other people may be invited yet.
