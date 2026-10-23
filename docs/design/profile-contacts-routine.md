# Patient profile, contacts, meals and exercise

Owner request of 2026-10-22, with a tester's note ("Add patient profile: Name
of patient, Age, Alerts: allergies, fall risk, contagious disease,
disabilities, and current medical conditions"), a diet-schedule template
(time, meal, food and drink, hydration, done) and a body exercise guide
(13 body areas, each with stretch, strengthen and mobility moves):

1. a patient profile with alerts;
2. emergency contacts, caretakers and doctors;
3. a diet schedule;
4. an exercise schedule: name, time, duration, with start and stop.

"We want it to be simple. That's the main vision." Written by @leader.

Screen mock-ups (nine phone screens, private to the owner's account):
https://claude.ai/artifact/CDFhvQ8qhVj1sXvRkFetjq

## 1. What must hold

- **Simple.** Each new screen is understood at a glance. Today gains one alert
  line at the top and two short sections below the medicines.
- **Each kind in its own section** (the owner's choice, 2026-10-22: "medicine,
  meal, and exercise should have their own categories or separate sections").
  The medicine sections on Today stay exactly as they are. Meals and exercise
  get a section each, below them.
- **Medicine alarms stay medicine alarms.** Only medicines turn LATE or MISSED
  and pulse. A late lunch or a skipped exercise never looks like a missed
  medicine, so the red keeps its meaning.
- **The medicine engine is not touched.** `todaySchedule.ts` and its tests stay
  as they are. Meals and exercises get their own small module.
- **One clock.** Meals and exercises use the same clock as the medicines on
  Today: the device's own time zone.
- **What was done stays true.** A record keeps the name, food and target it
  was done against. Changing the plan never rewrites the past.
- **Unknown is never "none".** Something not filled in, or not loaded, says so.
  It never shows as "no allergies" or "no fall risk".
- **Same rules as every family table:** a member of the family may read and
  write (as for medicines), every change is audited, the live-update ticker
  announces it, the family-separation suite covers it.
- Works on the website, in both apps and in presentation mode on the wall
  tablet.

## 2. What the caregiver sees

### 2.1 The alert line on Today

Directly under the date, only when something is filled in:

> ⚠ Allergic to penicillin, latex · Fall risk: two people to stand ·
> Contagious: C. diff, wear gloves

Red-tinted, at most two lines, then "+2 more". Tap it to open About. Only the
three things a helper must know before touching the patient are here:
allergies, fall risk, contagious disease. Disabilities and conditions are on
About.

### 2.2 About [name] (More)

- Name (the care recipient name the family already has) and date of birth,
  shown as age.
- Allergies, contagious diseases, disabilities, current conditions and diet
  cautions ("low sodium", "cut food small"): short lists, one line each, add
  and remove. Each list starts as "not filled in". A **None known** button
  records a real none, and adding an item clears it.
- Fall risk: yes, no or not filled in, with a note.
- Emergency notes: free text for what paramedics must know (for example
  resuscitation wishes, hearing aid, language).
- A button: **Emergency card**.

### 2.3 Contacts (More)

Four groups: **Emergency**, **Doctors**, **Caretakers**, **Pharmacy and other**.
Each row: name, role (relationship, specialty or agency), phone with **Call**
and **Text** buttons, a note. The number is always shown as text too, so it can
be read or copied on a device that cannot call. Call and Text use the phone's
own apps, with no new app permission. Emergency contacts come first. Caretakers here
are phone numbers. A caretaker does not need an app account, and app accounts
stay in Family & people.

### 2.4 Emergency card

One screen, plus "Save or share" as a PDF through the same share path as the
reports. It shows: name and age; allergies, fall risk, contagious diseases,
conditions; current medicines from the cabinet with dose and times; emergency
contacts and doctors with phone numbers; emergency notes; the date and time it
was made. For paramedics, a hospital admission or a new caretaker.

The card, and its PDF, appear only once the profile, alerts, medicines and
contacts have all loaded. If any part fails, the screen says so and offers
**Try again**; it never makes a card with gaps. Anything not filled in says
"Not recorded".

### 2.5 Meals and exercise on Today: their own sections

- The medicine sections (**Given · last 12 hours**, **Coming up · next 12
  hours**) stay exactly as they are: only medicines, the same rules and the
  same code. Nothing about meals or exercise appears in them.
- Below them, two new sections, each a list of **today's** planned times
  (midnight to midnight, device clock), one line per row, in time order:
  - **Meals · 4 of 6 done**: "3:30 PM Afternoon snack · crackers" with a
    **Done** button;
  - **Exercise · 2 of 4 done**: "8:00 PM Ankle pumps · 10 min" with a
    **Start** button.
- In each section the done rows fold into one line at the top ("4 done"); a
  tap opens them, with how much was eaten or the minutes, who did it and the
  time it was really done. Tap one of those to change it or undo it, as
  medicines already can be.
- A time that has passed without being done says "not done yet" in grey. No
  red, no pulse. Times before an item was added never count. When all are
  done, the section shows one line: "All 6 done".
- A section with nothing planned does not show on Today. More → Meals &
  exercise is where the plan is made.
- Each section loads on its own: if meals fail to load, medicines and
  exercise still show, each with its own message.
- On the tablet and in presentation mode the two sections sit side by side
  under the medicines when there is room.
- **Meal Done** opens a small sheet: "How much was eaten?" All, Most, Half, A
  little, None, who did it, the time (now, can be changed) and an optional
  note. The food allergies and diet cautions from About are shown on that
  sheet. If someone else has already recorded that meal, the sheet shows
  their record ("Done by Umair, 8:34 PM") and does not save a second one.
- **Exercise Start** opens a timer: the exercise name, a big running clock,
  the target ("10 min"), **Pause** and **Resume**, **Finish**, **Cancel**, the
  plan's "how to do it" note and the guide's safety line ("Sharp pain,
  numbness, tingling or swelling means stop"). Finish saves the real minutes.
  The timer keeps going through a tab change, a locked screen, a reload or a
  closed app. If saving fails, the timer stays, so nothing is lost.

### 2.6 The plan: Meals and exercise (More)

- Two short lists, **Meals** and **Exercises**, one row per time in time
  order, like the paper schedule: an exercise done twice a day shows at both
  times, and tapping either row edits the same item.
- Add a meal: name, time or times, food, drink. **Start from a
  typical day** adds the template's six meals (breakfast 8:00, snack 10:30,
  lunch 1:00 PM, snack 3:30 PM, dinner 6:00 PM, evening snack 8:30 PM) to
  edit, or delete.
- Add an exercise: tap a body area (the guide's 13: feet, legs, knees, hips,
  back, neck, shoulders, thighs, fingers, elbows, calves, jaw, head), pick a
  move from its list, grouped as the guide groups that area (for knees:
  Strengthen, Stretch, Mobility), or type your own; then time or times,
  target minutes and a "how to do it" note ("10 each leg"), which the timer
  shows.
- **Stop from a date** ends an item. There is no pause in this step. An item
  that has records is only ever stopped, never deleted; one with no records
  can be deleted.
- A change counts from then on, and past records keep what was done. **New
  times start tomorrow.** Today keeps today's times, so nothing done today
  can reappear or be recorded twice. The edit screen says so in one line.

## 3. How it is built

### 3.1 Data (one migration, staging only)

- `care_profiles`: one row per family. `id` primary key, as on every other
  family table, so the shared audit trigger works unchanged: it keys
  ordinary tables by `id`, and `audit_log.row_key` is NOT NULL, so a table
  without `id` would fail every save. `household_id` unique (cascade),
  `date_of_birth` date null, `fall_risk` boolean null (null = not filled in),
  `fall_risk_note`, `none_known` (the alert kinds the family has confirmed
  as none, limited to the five kinds below), `emergency_notes`, `updated_at`.
- `care_alerts`: `id`, `household_id`, `kind` in (`allergy`, `contagious`,
  `disability`, `condition`, `diet`), `text` (1–120), `note`, `sort`,
  `created_at`.
- `contacts`: `id`, `household_id`, `kind` in (`emergency`, `doctor`,
  `caretaker`, `other`), `name` (1–80), `role`, `phone`, `phone2`, `email`,
  `address`, `notes`, `sort`, `created_at`, with length limits.
- `routine_items`: `id`, `household_id`, `kind` in (`meal`, `exercise`),
  `name` (1–80), `schedule_time` (the same text format as
  `medicines.schedule_time`, read by the same `parseScheduleTime`), `details`,
  `drink` (meals), `target_minutes` (exercises), `area` and `move_type`
  (exercises from the guide), `start_date`, `end_date` (Stop from a date),
  `previous_schedule_time` and `schedule_from` (date), `created_at`. A change
  of times keeps the times in force today in `previous_schedule_time` and
  sets `schedule_from` to tomorrow; days before `schedule_from` use the
  previous times. A second change on the same day keeps the first saved
  previous times. `details` is the food for a meal and the "how to do it" note
  for an exercise. `drink` is for meals only.
- `routine_logs`: `id`, `household_id`, `item_id` (family-scoped foreign
  key, delete restricted: an item with records is stopped, not deleted),
  `for_date` and `for_minute` (the planned time it fulfils, like linked
  doses), `done_at`, `caregiver_id` (family-scoped too), `recorded_by`,
  `amount` in (`all`, `most`, `half`, `little`, `none`) for meals, `minutes`
  for exercises, `note`, and a copy of the item's `kind`, `name`, `details`,
  `drink` and `target_minutes` taken when it was done.
  - One record per item per planned time (unique). Saving only inserts. On a
    clash the app shows the record that is already there. Changing a record
    is a separate edit that keeps who did it unless that is changed.
  - `done_at` is when it really happened. It sets the day and the order in
    History and in the done rows, as a medicine's given time does.
    `for_date` and `for_minute` say which planned time it was for. So an
    11:30 PM snack given at 12:10 AM fulfils the evening before's 11:30 PM
    on Today, and History lists it at 12:10 AM, "for Oct 22, 11:30 PM",
    the way a late dose shows its scheduled time.
- Each table: member-only row security, the audit and ticker triggers,
  explicit grants, nothing published to realtime, generated types refreshed,
  family-separation and hostile-subscription tests.

### 3.2 App

- `src/lib/routineSchedule.ts`, pure and unit-tested like the dose rules: the
  planned times in the 12-hour windows, start and stop dates, done or not
  done, midnight and daylight-saving changes.
  - **Clock:** the device's time zone, the same clock `TodayScreen` already
    uses for medicines (`format(now, 'yyyy-MM-dd')` and local times). The
    family's stored time zone is not used on Today; if it ever is, medicines
    and routines move to it together.
  - **Matching:** a record matches a planned time by exact minute only.
    Because new times start tomorrow, a day's planned times never change
    under its records, so the unique key (item, date, minute) is always
    exactly one occurrence, in the app and in the database alike.
- Today: two new section components, Meals and Exercise, fed by
  `routineSchedule.ts`, each with its own loading, empty and error states.
  The medicine sections, `todaySchedule.ts`, `doseGroups.ts` and
  `DoseTimeGroups` are not touched, and nothing is merged into them.
- Timer:
  - It is kept on the device per user and family, keyed as recordings are
    (`recordingJobStore`): time so far, running since, running or paused,
    which item and planned time, and who.
  - Its owner sits above Today, beside the recording provider, so changing
    tabs does not stop it, and a reload or a killed app picks it up again.
  - Finish clears it only after the save is confirmed. Cancel clears it
    without saving. One timer at a time.
  - While it runs, app updates wait (`useUpdateSafety`). No background
    service: the clock is worked out from the saved times.
- Live updates: the ticker's table-to-keys map gains the new tables.
- History:
  - Meal and exercise records appear in the day's diary at the time they
    happened, with who, using the copied name and details.
  - **Food:** on a day with meal records, History shows a Meals line
    ("Meals recorded: 4 · breakfast all, lunch most…") and drops the daily
    "Food: No". A daily "Food: Yes — …" still shows, since it may describe
    feeds or extras. There is no "4 of 6" for past days: the plan as it
    stood on a past day is not kept. Today's own count ("6 of 10 done
    today") is fine, since today's times cannot change.
  - Meals never change the daily record, feeds, flushes or fluids. The day
    editor shows "Meals recorded today: 4" above its Food field.
- Reports: no change in this step (phase 3).
- The exercise guide becomes a static list of names in the app, exactly as
  in the guide. It is only a name picker: nothing is fetched, and no sets,
  repetitions or programme are suggested.

## 4. Phases

1. **About, the alert line, Contacts and the Emergency card.** Small, no
   schedule logic. It ships on its own, with the profile's own `id` and the
   card's loading gate.
2. **Meals and exercise:** the plan screens, the two Today sections, the meal sheet,
   the timer, Done, History.
3. **Later:**
   - report additions (a profile header, meals eaten, exercise minutes);
   - pausing a plan item;
   - picking a doctor from Contacts when adding an appointment;
   - a warning when a new medicine's name matches an allergy;
   - reminders for meals and exercise with the medicine reminders.

## 5. Checks

- Unit tests for the routine rules: a time changed today (it starts
  tomorrow, and a sheet left open from before still saves to today's time),
  midnight, daylight saving, and a device in a different time zone from the
  family's (medicines and routines must agree).
- Audit for each new table: an insert, a change and a delete each record the
  actor and the row key, and bump the ticker.
- Family separation for the five tables, including a record that points at
  another family's item or caregiver.
- Browser tests for each new flow:
  - a meal and an exercise done on one page and seen on another;
  - two people finishing the same meal;
  - the timer surviving a reload;
  - the Emergency card when one part fails to load.
- Screen sweeps at 320, 360, 393, 800 and 1280 wide, and in presentation
  mode.
- On devices: Call and Text open the phone's own apps, and the timer survives
  the app going to the background and being closed.

## 6. The owner's decisions (2026-10-22)

1. Medicines, meals and exercise each in their own section on Today, not one
   timeline.
2. Any family member may edit About and Contacts, as for medicines.
3. Date of birth is stored and shown as age.
4. Build phase 1 now, then phase 2: "Once I wake up, it should be ready."

## 7. Not in this step

Calories and nutrition databases, exercise videos or animations, counting
repetitions, wearables.
