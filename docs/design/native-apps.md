# Apple and Android apps (step 1: the app shell)

Owner request of 2026-10-12: "the next step is to convert this into an Apple and
Android app", "we will still keep the web version as well". Written by @leader.

The plan has three steps. This document specifies step 1 and only outlines the
other two.

1. **The app shell.** The app we have, running as a real iPhone, iPad and
   Android app on the owner's own devices, talking to staging.
2. **Reminders.** The server decides which doses are due and sends the alert,
   checking at that moment that nobody has recorded the dose already.
3. **Going public.** A production database, a proper email service, a website
   address, privacy text, in-app account deletion, store listings and review.

## 1. What must hold

- One codebase. The website, the iPhone app and the Android app are built from
  the same source. The website keeps working exactly as today and keeps being
  published to staging the same way.
- Nothing changes for a browser. Every new behaviour sits behind one question,
  "is this running inside the phone app?", and the browser answer is today's
  code path. The whole existing test suite passes unchanged.
- The app carries its screens inside it. It loads no remote page and no remote
  script, and can only talk to the staging project it was built for.
- No secrets in the app: only the same public values the website already
  carries. A build refuses to continue if it would contain the live family
  project.
- Anything that needs the owner's Apple or Google sign-in, a signing
  certificate, a key or an accepted agreement is done by the owner himself.
- Simple to operate: the app looks and works like the website. No new screens
  in this step.

## 2. What the owner gets in step 1

- **iPhone and iPad:** the app installed from this Mac onto his own device, and
  running in the simulator for our checks.
- **Android:** an installable test file (APK) put onto his phone or tablet by
  cable.
- Same sign-in, same data, same features as the staging website, including
  the camera for prescription photos, the microphone for doctor conversations
  and the PDF reports.
- Not yet: reminders, recording with the screen off, the app stores, other
  family members (see §7).

## 3. How it is built

Capacitor 8 wraps the built website (`dist`) in a native project for each
platform. Requirements checked on 2026-10-12 against Capacitor's setup page:
Node 22 or newer (this Mac: 25.9), Xcode 26 or newer (this Mac: 26.6), Swift
Package Manager by default so CocoaPods is not needed, Android Studio 2025.2.1
or newer with an SDK platform of API 24 or higher. Android Studio brings its
own Java.

- Packages pinned to exact versions, like the hosting tool: `@capacitor/core`,
  `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`, and only these
  official plugins: `app`, `share`, `filesystem`, `preferences`, `status-bar`,
  `keyboard`, `splash-screen`. A community plugin is added only where §4 says
  a browser feature fails inside the shell, and @leader is told first.
- `capacitor.config.ts`: app id `com.fahadakbar.myht` (the owner's account is
  in his own name; the id is permanent once a store listing exists, so it is
  confirmed with him before step 3), display name "Health Tracker" for test
  builds, `webDir: 'dist'`, no `server.url`, no extra allowed navigation.
- The native projects live in `ios/` and `android/` and are committed. Build
  output, signing files and keystores are ignored and never committed.
- One helper, `isNativeApp()`, and one small file per capability under
  `src/native/`. Each has a browser branch that is today's code.
- Two build targets, never mixed (found by @coder's review: the staging check
  rightly rejects local addresses, and the simulator checks need the local
  stack):
  - `npm run app:build:staging` builds the site with the staging values and
    the native flag, runs the existing static staging check on the result
    (staging host only, no local address, no live project), then syncs it
    into both native projects. This is the only build that goes onto a real
    device.
  - `npm run app:build:local` is for the simulator and emulator only: the
    exact local stack address (the Android emulator reaches the Mac at
    `10.0.2.2`), made-up data, its own output folder and its own guard. The
    hosting script never accepts it.
  - If the local target needs permission for plain `http` to this Mac, that
    allowance exists only in the local build. A check on the staging app
    fails if the allowance, or any local address, is present.
- `npm run app:ios` and `npm run app:android` open or build the platform
  project. None of these commands uploads anything.

## 4. What behaves differently inside a phone app

Found by reading the code on 2026-10-12. Each line is: what, where, and what
the shell does about it.

| What | Where today | In the app |
| --- | --- | --- |
| Staying signed in | `localStorage` in `src/integrations/supabase/client.ts` | Native builds store the session with the `preferences` plugin (the phone's own app storage); the browser keeps `localStorage`. |
| PDF reports | `jsPDF … .save()` in `DashboardTab`, `MedicineReportCards` | A download does nothing in a phone shell. Write the PDF to the app's cache and open the system share sheet (save to Files, print, send). |
| Sharing an invite | `navigator.share` in `HouseholdSetup`, `FamilyPeopleTab` | Use the `share` plugin; Android's shell has no `navigator.share`. |
| Prescription photos, transcript upload | file inputs in `PrescriptionPhotoScreen`, `TranscriptsTab` | Keep the inputs. Add the camera and photo permission texts; verify "Take a photo" and "Choose photos" on both platforms. |
| Recording a doctor conversation | `MediaRecorder`, `getUserMedia`, `wakeLock`, IndexedDB in `RecordingProvider`, `recording.ts`, `recordingJobStore.ts` | Keep the recorder. Add the microphone permission text. Verify a two-minute recording, the retry after a failed upload and the recovered-recording message on both platforms. If the screen wake lock does not hold inside the shell, tell @leader before adding a plugin. |
| The app updating itself | `AppUpdate` and `version.json` | Off in the app: its screens are inside it and new versions arrive as new builds. |
| The notch, the home bar, the status bar | page and bottom bar paddings | `viewport-fit=cover` and safe-area paddings for the top bar, the bottom bar and bottom sheets; dark status-bar text on the app's cream background. |
| The on-screen keyboard | forms in bottom sheets | The focused field stays visible above the keyboard on both platforms. |
| Android's back button | none | Closes an open sheet or dialog first; otherwise goes back one screen; on the Today screen it sends the app to the background, it does not close a form silently. |
| Icon and start screen | only `favicon.ico` | A simple placeholder icon and start screen in the app's colours, replaceable later by the owner's own. |
| Fonts | `index.html` loads them from Google | The app carries the same fonts inside it (they are open-licence fonts), so it makes no request to anyone but staging. The website is left as it is. |
| The address in an invite message | `window.location.origin` in both invite screens | Inside the app that would be `capacitor://localhost`. The app uses the public website address it was built for (staging: `https://myht-staging.pages.dev`); the browser keeps its own address. |
| Saving a recording | `<a download>` in `RecordingProvider.downloadAudio` | Same as the PDF reports: write the file to the app's cache and open the share sheet. |

Permission texts, in plain words:

- Microphone: "To record a doctor conversation when you press Record."
- Camera: "To take a photo of a prescription or a medicine label."
- Photos: "To choose a photo of a prescription or a medicine label."

Nothing else is requested: no location, no contacts, no tracking, no
notifications in this step.

## 5. Checks

- Everything that exists passes unchanged: both type checks, the unit tests,
  the build, the family-separation suite, the browser suite and the screen
  suites. The staging website behaves as before: a browser can only reach
  the browser branch of each helper.
- Unit tests for each file in `src/native/`: the browser branch is today's
  behaviour; the native branch calls the plugin with the right arguments
  (plugins mocked).
- The static staging check runs on the app bundle too: staging host only, no
  live project, no key.
- iOS: `xcodebuild` builds for the simulator; the app is installed and started
  in an iPhone and an iPad simulator; screenshots of the first screen and,
  after a test sign-in on the local stack, of Today, the medicine cabinet and
  the photo screen, for @leader. The first start of the simulator service can
  take minutes on this Mac.
- Android: a debug APK builds; the same screenshots from an emulator.
- A written checklist for the owner's own devices (§6), because the camera,
  the microphone, the keyboard and the share sheet can only be judged on a
  real phone.

## 6. What only the owner can do

- Add his Apple account in Xcode on this Mac (Xcode → Settings → Accounts) and
  connect his iPhone by cable, with Developer Mode switched on in the phone's
  privacy settings. Nobody else types his password.
- For Android: switch on USB debugging on the tablet or phone and connect it,
  or allow installing the test file.
- Accept, or tell us to accept, the licence terms the Android tools show on
  first start.
- Try the checklist on his devices and say what feels wrong.

## 7. Not in step 1

Reminders and anything that sends a notification. Recording with the screen
off. TestFlight, Play testing tracks and the stores. Other family members:
staging still has email confirmation off, so nobody else joins before step 3.
A final name, icon and app id. Offline use.

## 8. Step 2 and step 3 in outline

- **Reminders.** Device registration per signed-in person; a server job every
  few minutes that works out due doses per family with the same rules as
  `todaySchedule.ts` (one implementation, shared), looks at the records at
  that moment, and sends through Apple's and Google's push services; settings
  for who is reminded and what the lock screen may show; an honest delivery
  log. A wrong reminder is worse than none, so this step is specified and
  tested like the dose rules were.
- **Going public.** Production project with backups, the proper email service
  that was parked on 2026-10-10, a website address, privacy text, in-app
  account deletion (Apple requires it where accounts can be created), store
  listings, screenshots and review. New personal Google Play accounts must run
  a closed test with 12 testers for 14 days before a public release (checked
  2026-10-10; confirm again then).
