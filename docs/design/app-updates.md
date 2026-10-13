# Getting the app and every update to people who are elsewhere

Owner request of 2026-10-12: "the testers that I have, they're not at my
home… we need to devise a kind of a system where once we make an update… they
are very easily able to… update on their phone, on their tablets, all the
updates that we make. This is the very major thing that I want to do."
Written by @leader. It continues `docs/design/native-apps.md` (step 1) and
comes before reminders.

## 1. What must hold

- A tester far away installs once, by tapping a link. After that, updates
  arrive without the owner, the leader or the coder touching the device.
- One routine releases the website, the iPhone and iPad app and the Android
  app from the same checked commit.
- An app that is too old says so and stops as soon as it notices. This is a
  strong prompt, not a lock: until every phone has noticed, the server still
  accepts what the older build writes (§4). It never interrupts a recording,
  an open sheet, an unsaved form or a save.
- The app still carries its screens inside it and talks only to the project it
  was built for. No code is downloaded while it runs (see §10).
- Nobody but the owner signs up before the email gate is closed
  (`accounts-and-families.md` §12, owner decision of 2026-10-10).
- No secret in the repository: no signing key, no password, no team id.
- Anything that needs the owner's sign-in, payment, identity or an accepted
  agreement is done by the owner.

## 2. What a tester does

iPhone or iPad (iOS 16 or newer):

1. Install Apple's TestFlight app from the App Store.
2. Tap the link the owner sent. Accept, then Install.
3. Leave "Automatic Updates" on. New versions install by themselves and
   TestFlight says so.

Android phone or tablet (Android 7 or newer):

1. Tap the link the owner sent, signed in to the Google account the owner
   listed, and join the test.
2. Install from the Play Store.
3. New versions arrive through the Play Store like any other app.

Any device: the website keeps working, updates itself and needs no install.

## 3. The two channels

Checked on 2026-10-12 in Apple's App Store Connect help and TestFlight page,
and in Google's Play Console help.

**iPhone and iPad: TestFlight, external testers.**

- Up to 10,000 testers per app, invited by a public link or by email. We use
  one public link with a small limit on how many people can join. Anyone who
  has the link can join until the limit; the link can be switched off.
- Apple reviews the first build of a version before outside testers get it.
  "Later builds for the same version might not" need a full review. So the
  version stays 1.0 during the test and only the build number rises. At most
  six builds a day can be sent for this review.
- Apple wants a description of the test app, a feedback email, the owner's
  contact details, and a sign-in for its reviewer (a made-up family on the
  test server).
- A build stops opening 90 days after upload. So there is a release at least
  every 80 days, even with nothing new.
- Each new build is added to the testers' group in App Store Connect, with
  "Automatically notify testers" on. The owner's own group "Own devices" keeps
  getting every build at once, without review.

**Android: Google Play, internal testing.**

- Needs the owner's Google Play developer account: US$25 once, an identity
  check, and a check with the Play Console app that he has an Android device.
- Up to 100 testers, listed by the email of their Google account. A new
  bundle "becomes available to testers within minutes"; the first link "can
  take several hours". It can start before the store listing is filled in.
- Play wants an app bundle (`.aab`) signed with our upload key. Google keeps
  the key that phones see (Play App Signing).
- The package name is fixed for good once the first bundle is uploaded. It is
  `com.fahadakbar.myht`, the same id as on Apple. A different final id at the
  public launch would be a new app that testers install once more.
- Internal testers do not count for the rule that a new personal account runs
  a closed test with 12 testers for 14 days before a public release. That is
  met later, as part of going public.
- The test build the owner installed from this Mac on 2026-10-12 is signed
  with this Mac's debug key. It is removed once before the Play version is
  installed. Removing an app erases what only that device holds: a recording
  that has not finished uploading, and the note that lets the app recover it.
  So first stop any recording and let waiting uploads finish, or save the
  audio out of the app and check the saved file. Records already on the server
  are not touched.

**Not chosen.**

- Sending an install file by link, as was done for the owner: every update is
  a download, a warning and several taps, and a build signed on another
  machine will not install over it.
- Adding relatives as users of the owner's Apple developer account (no review
  wait): they would have to join his account and would see more than the app.
- Firebase App Distribution: still an install file on Android, and on iPhone
  it needs each phone registered.

## 4. The check inside the app: "too old"

Why: the website always runs the newest code. An installed app runs whatever
was installed. All of them use one database. When the rules for records
change, an old app should stop quickly and tell the person why.

**Server.** One new table, `public.client_builds`: a row per platform (`ios`,
`android`) with `min_build` (a whole number, 0 at the start) and `updated_at`.
Signed-in people may read it (an explicit grant and a read-only policy).
Nobody may write it through the API. It holds nothing about any person or
family. It is not part of realtime and has no household audit trigger. The
generated types are refreshed.

**App (native only; the website keeps its own updater).**

- It sits inside the signed-in part of the app (`ProtectedRoute`), before the
  family and set-up screens first appear. While the "Update needed" screen
  shows, the checks keep running, so lowering the number lets the app back
  in. It never clears a saved recording job.
- The app's own build number comes from the phone (`App.getInfo()`), not from
  a value baked into the screens.
- It reads its row when a session appears, when the app comes back to the
  front, and every 10 minutes while it is visible (a tablet can stay open for
  days).
- Right after start, the signed-in screens wait for the first answer, for a
  few seconds at most. Later checks never hold the screen.
- Own build below `min_build`: the "Update needed" screen replaces the app.
  Text: "This version is too old to keep your records right. Update the app,
  then open it again." One button: "Open TestFlight" on Apple, "Open Play
  Store" on Android. Under it the version, for example "Version 1.0 (372)".
  There is no way past it. If the phone cannot open the store, the text still
  says what to do.
- It waits while someone is busy, with the same rules as the website's
  updater (work held with `useUpdateBusy`, a save in flight, an open sheet or
  dialog, an edited field): a bar says "This app needs an update. Finish this
  first." and the screen appears when the work is done. A recording is never
  cut. These rules are taken out of `AppUpdate` whole (the remembered field
  values and the held work included) and shared, not copied. The website
  behaves exactly as before.
- If the row cannot be read (offline, an error, a missing row, a value that is
  not a whole number): the app carries on and asks again at the next moment.
  A failed check must not lock a family out.
- Signed out: no check. Everything that writes needs a session.
- No new plugin unless a plain link cannot open TestFlight or the Play Store;
  tell @leader first.

**Version on the More screen:** "Version 1.0 (372)" in the app, the short
commit and the build date on the website. A tester can tell us what they have.

**What the check is not.** It does not make a breaking server change safe.
After the number is raised an old app can still write for up to ten minutes,
for as long as someone is busy in it, and whenever its check fails. The two
builds handed out before this step (the owner's iPhone build 359 and his
Android test build) have no check at all. So the rule for the server stands on
its own: every database and function change keeps the builds people still have
working. If old apps ever have to be refused for certain, the server has to do
the refusing; that is a separate design and not built here.

**Raising the number** is a step of a release, never automatic:

1. A server change keeps the builds people still have working (add first,
   remove later).
2. The new build is published and visible in both stores.
3. Then `min_build` is raised to that build, with one statement on the server.
4. What the older builds needed is removed from the server only when no build
   still in use needs it (both stores show which builds the testers have), or
   after a server-side refusal of old builds has been designed and reviewed
   on its own. Waiting some time is not enough.

## 5. The Android store build

- `npm run app:android:release`, only after `npm run app:build:staging`, on
  the same commit (the receipt that the iPhone release already checks).
- Version code = the number of commits (`git rev-list --count HEAD`), the same
  number as the iPhone build made from that commit. Version name stays 1.0.
  The debug build keeps working without it.
- Signed with the upload key. The key file and its password live outside the
  repository. The script takes them from the environment of that one command,
  refuses to build without them and never prints them. Missing values never
  break the debug or the local build: only the release command demands them.
- The finished bundle is checked like the iPhone package: staging assets only,
  package `com.fahadakbar.myht`, the expected version code, not debuggable,
  backups off, no plain-http allowance, no local address. A bundle's manifest
  is not plain text, so it is read with the bundletool that already comes
  with the Android build tools; nothing new is downloaded. A proof tied to the
  commit is written under `test-results/native/`.
- No upload command in this step. The bundle is uploaded in Play Console by
  hand.
- `app:android:build` (the debug build for the emulator) stays as it is.

## 6. The release routine

1. The batch is audited, committed and pushed, and the website is published,
   as today.
2. `npm run app:build:staging`.
3. iPhone: archive, export, upload (the existing commands). In App Store
   Connect: add the build to the testers' group with one line of "what to
   test".
4. Android: `npm run app:android:release`, upload the bundle to internal
   testing in Play Console, roll out.
5. Look: the build shows as available in both places.
6. Only when the release needs it: raise `min_build` (§4).

Not every website update needs a phone release. Phones get one when a batch
changes what people see or fixes something they reported.

The release commands are run by @leader: they need this Mac's keychain and
Xcode account, which the coder's sandbox cannot reach.

## 7. Before the first other person

- **Email.** A sending service on a domain the owner controls, set as custom
  SMTP on the test project; "Confirm email" ON; the six-digit code, forgot
  password and invite flows passed against real inboxes (`docs/STAGING.md`).
  Supabase's built-in sender only writes to the project's own team and sends
  two messages an hour (checked 2026-10-12), so it cannot do this.
- **The reviewer's account** for Apple: a made-up family on the test server.
- **Plain words for testers**, in the message that carries the links: this is
  a test; the test server has no backups, so keep using what you use today for
  anything you rely on; prescription photos and recordings are sent to OpenAI
  to be read.
- A wipe of the test server still needs the owner's yes and, from now on, a
  warning to the testers first.

## 8. Checks

- Everything that exists passes unchanged, the website included: the tests of
  the website's updater pass as they are after its busy rules are shared.
- Unit tests for the decision (too old, equal, newer, busy, unreadable row,
  nonsense values) and for reading the phone's build number (plugin mocked).
- The family-separation suite: a signed-in person reads both rows; nobody
  signed out reads them; nobody inserts, changes or deletes them.
- On the emulator and the simulator, against the local stack, by @leader:
  raise the local number above the build and the screen appears; with a sheet
  open, the bar first and then the screen; lower it and the app works again;
  with no network the app carries on.
- The Android bundle check fails on a debuggable bundle, a wrong version code
  and a local address (proved on made-up inputs).
- On real devices, by the owner: the button opens TestFlight or the Play
  Store.

## 9. What only the owner can do

- Open the Google Play developer account (payment, identity, device check).
- Name the domain and approve buying it.
- Give the Google account emails of the Android testers.
- Type his phone number and the reviewer's password into Apple's form.
- Send the links to the testers.

## 10. Not in this step

- The app downloading new screens by itself (over-the-air updates). It would
  make phone updates as fast as the website's. It also lets a server change
  the code on every phone, which needs its own signing, a check against both
  stores' rules and a review of its own. The stores' test channels update
  phones by themselves within hours; revisit only if that proves too slow.
- Uploading to Google Play by command; builds on a build server.
- A production project with backups, a public store listing, the closed test
  Google needs before a public release, the final name and id.
- Reminders.
