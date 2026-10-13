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
In App Store Connect the app entry is "MyHT Family Health". Its internal group
"Own devices" has automatic distribution and the owner as its only tester, so
each uploaded build reaches Apple's TestFlight app on his iPhone without
another step on Apple's website. A TestFlight build stops opening 90 days after
upload, so upload a new one before that. Under the icon on the phone the app is
still called "Health Tracker". Nobody else is added as a tester before step 3.

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

## Remote testers and later releases

Before inviting anyone, complete the email-confirmation/SMTP gate in STAGING.md.
iOS testers join the external TestFlight group; Android testers join Google
Play internal testing. The owner manages the tester lists and store accounts.

Release from one audited commit: commit/push, publish the website, run
`npm run app:build:staging`, then iOS archive/export/upload and add the build to
the external group. Run `npm run app:android:release` and upload its bundle to
Play Console by hand. Leader verifies availability to both tester groups.
Only then raise the relevant `client_builds.min_build` if the release needs it.
This is a best-effort upgrade prompt, not a server-side write lock. Keep old
server behaviour until no supported build needs it or a separately reviewed
server-side cutoff exists; elapsed time alone is insufficient.

Android release uses `ANDROID_KEYSTORE` (an absolute path outside the repo),
`ANDROID_KEY_ALIAS`, `ANDROID_KEYSTORE_PASSWORD`, and `ANDROID_KEY_PASSWORD`
from that command's environment. With the owner's yes, @leader creates the
upload key on this Mac outside the repository and arranges its backup. Google
can reset a lost upload key.
No key is created by the script. It uses JDK 21 and the existing SDK, sets
versionCode to the Git commit count and versionName to 1.0, then checks the
actual AAB manifest with AGP's bundled bundletool and scans the extracted
assets. JDK 21 keytool checks that the bundle's SHA-256 signing-certificate
fingerprint matches the specified upload-key alias; its password is supplied
by environment reference, never a command-line password. The certificate
fingerprint and bundle SHA-256/commit proof stay under ignored build outputs
and `test-results/native/android-release.json`. Missing signing values do not
affect debug/local builds. There is no Android upload command.

Staging asset builds record whether the tree was clean (only unstaged
`AGENTS.md` may differ), both before and after building. iOS archive/export/
upload and Android release require that clean receipt, the same commit, and
a currently clean tree. Commit and rebuild before releasing uncommitted work.

Read the release hints in the database SQL editor:

```sql
select platform, min_build, updated_at from public.client_builds order by platform;
```

After verifying availability to the intended testers, substitute the actual
build number and platform, then raise that platform's minimum:

```sql
update public.client_builds set min_build = 372, updated_at = now() where platform = 'ios';
```

Use `platform = 'android'` for Android. The statement is manual; scripts never
raise a minimum automatically.

Before replacing the debug Android app with the Play version, stop recording
and finish pending uploads, or save the audio outside the app and verify it.
Uninstalling erases device-local recordings and recovery pointers. Server
records remain, but an unfinished conversation may otherwise be lost.
