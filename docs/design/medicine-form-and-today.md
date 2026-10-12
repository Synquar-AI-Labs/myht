# Medicine form, dose times and the Today lists (batch M1)

Owner decisions of 2026-10-11. Written by @leader; @coder builds it; @leader audits.
One batch, because every part touches the same rules. Nothing here changes how a
recorded dose is paired with a scheduled time.

## 1. What must not move

- `buildUpcomingList` keeps its rules: only medicines with `frequency` `daily`
  (or empty), category medicine, shown in quick log, with readable times are
  scheduled; a dose pairs one-to-one with the nearest slot within 1 hour; due
  within 15 minutes, overdue for 2 hours, then gone.
- Attribution rules, household scoping, the ticker, the day-record functions.
- Readings and custom trackers keep their hour-only time. Only medicine doses
  gain minutes.
- No value already stored is rewritten unless the person edits that medicine.

## 2. Stored data (deliberately almost unchanged)

- `medicines.schedule_time` stays text, now written only by the form in one
  canonical shape: times as `h:mm AM` joined by ` / `, ascending, no duplicates
  (`6:00 AM / 10:00 AM / 2:15 PM`). The existing parser reads it.
- `medicines.frequency` keeps today's values: `daily`, `every 2 days` …
  `every 7 days`, `as needed`. "Every N hours" is NOT a stored frequency; it is
  a helper that fills in times. So such a medicine is `daily` and stays in
  "Coming up".
- `medicines.med_type` stays text; a custom type is stored as typed.
- New additive migration: `medicine_logs.minute smallint NOT NULL DEFAULT 0
  CHECK (minute BETWEEN 0 AND 59)`. Types regenerated.

## 3. The medicine form (Medicine cabinet)

Headings are questions, in this order:

1. **Which days is it given?** Every day · Every 2 days … Every 7 days · Only
   when needed.
2. **At what times?** (hidden for "Only when needed", which saves no times)
   - Each time is a drop-down of the 96 quarter-hours, `12:00 AM` … `11:45 PM`.
     An empty one opens near 8:00 AM. "Add another time", remove per time,
     no duplicates, saved in time order.
   - Helper link: **"Given every few hours? Fill the times in for me."** →
     "Every [1–12] hours, starting at [time]". For 1, 2, 3, 4, 6, 8, 12 it
     fills the full round-the-clock set (24 ÷ N times). For 5, 7, 9, 10, 11 it
     fills from the start time until midnight and says: "N hours does not fit
     evenly into a day, so the gap overnight will be different. Change the
     times if you need to." (The overnight gap can be shorter or longer than N,
     depending on the start time, so the text must not say which.) The filled
     times stay editable. Filling replaces the times already in the list; if
     the list is not empty, ask first, inline: "Replace the times you picked?"
     At most 24 times.
3. **Read-back sentence**, always visible above Save, built by one pure function:
   - "Given every day at 6:00 AM, 10:00 AM and 2:00 PM."
   - "Given every day. No times set, so it will not appear under Coming up."
   - "Given every 3 days at 9:00 AM. Medicines given every few days are not
     listed under Coming up yet; record them from Record a medicine."
   - "Given only when needed."
4. **Type**: choosing "Other" shows a text box "What kind of medicine is it?"
   (up to 30 characters). Saved text becomes the type; empty saves `Other`.
   Editing a medicine whose type is not in the list shows "Other" with the text.

A stored time that is readable but not on a quarter hour (for example 9:10 AM)
is never rounded. It appears in its drop-down as one extra entry, "9:10 AM
(earlier entry)", stays selected and is saved back unchanged until the person
picks another time. The same rule applies to a recorded dose whose minute is
not a quarter. The read-back sentence shows such a time as it is.

Medicines saved before this change: readable times appear in the drop-downs. If
the old text holds anything the parser cannot read, show it ("Earlier entry: …")
and, on the first save, keep that text by adding it to the note if it is not
already there. An unknown stored `frequency` value is shown as it is and left
alone unless the person picks another.

## 4. Recording a dose

- The dose sheet and the dose form in "Edit this day" use the same quarter-hour
  drop-down instead of hour + AM/PM. Default: now, rounded down to the quarter.
- Saved as `hour`, `am_pm`, `minute`. `logDateTime`, "Given", History, the dose
  list and "Copy previous day" all carry the minute.

## 5. Today: lists grouped by time

- **Coming up** shows one row per time: the time, a relative label ("in 20
  minutes", "in 1 hour 48 minutes", "in 2 hours", "now", "25 minutes late") and a count ("2
  medicines"). Under 60 minutes use minutes; from 60 minutes use hours and
  remaining minutes, omitting zero minutes and using singular units correctly.
  Each row has a turning chevron and aria-expanded. A row opens to its medicines;
  each medicine has a visible "Record" cue at the right, with the whole medicine
  row as the tap target. Tapping opens the dose sheet as today.
  The nearest row is open by default; the others are closed.
  A row takes the most urgent state of its medicines (due flashes, overdue is
  marked). More than 6 rows: show the 6 nearest times in chronological order
  and "Show N more times".
- **Given** is grouped the same way by recorded time, newest first, closed by
  default: time, "2 hours ago" or "1 hour 5 minutes ago", "3 given"; opened, each
  medicine with who gave it. These rows also have a turning chevron and
  aria-expanded, but the medicines inside have no "Record" cue.
- Grouping is presentation only, done by pure functions over the existing lists.

## 6. Today: layout

- "Visuals & trends" becomes the fifth pill under the four record pills: same
  size and spacing, closed by default on every screen size. Opened, it shows the
  first chart and "More charts", as the wide design does now. The always-open
  variant is removed.
- Wide screens: two independent columns. Left: Coming up, then Given. Right:
  "Record & review" with the five pills. No row alignment between the columns,
  so no gap can open. Phone order is unchanged.

## 7. Checks

- Everything that passes today still passes: unit tests, 25 isolation tests,
  10 browser flows.
- New unit tests: schedule text round trip, the every-N-hours filler (both
  kinds of N), the read-back sentence, relative labels, grouping, minutes in
  `logDateTime`, old and unknown stored values.
- New browser tests: (k) the form: pick times, the filler for every 4 hours
  gives six times, sentence, "Other" type, every 3 days stays out of Coming up,
  an old typed time still shows; (l) Today: rows by time, nearest open, record
  from a row at a quarter-hour and see it under Given on a second session; the
  charts pill closed then opened at a phone and a tablet size.
- The screens run again for Today, Medicine cabinet, the dose sheet and Edit
  this day at all 14 sizes.

## 8. Batch M2a (owner, 2026-10-11)

### 8.1 Due and late must be loud again

The regrouping kept the flashing row but dropped the strong badge, so "due" is
now a faint tint with small text. Restore it:

The owner wants urgency shown by colour as well as by blinking, growing with
lateness. Three urgent states for an unrecorded scheduled dose, one source of
truth in `todaySchedule.ts` used by "Coming up" AND the "Record a medicine"
list (today's single `due` state, 15 minutes either side, is split in two):

| State | When | Colour | Badge | Motion |
| --- | --- | --- | --- | --- |
| soon | from 15 minutes before, up to the time | amber `#b45309` on `#fef3c7` | SOON | slow pulse (2.4s) |
| due | from the time, up to 15 minutes after | red `#c2410c` | DUE NOW | pulse (1.2s) |
| late | 15 minutes to 2 hours after | dark red `#7f1d1d` | LATE | pulse (1.2s) |

- Green is NOT used here: in this app green already means "given".
- Each state changes the row tint, the badge and the relative label ("in 10
  minutes", "now", "25 minutes late"); never colour alone. Badge text is white
  on the state colour (amber badge: dark text on the light amber), contrast at
  least 4.5:1.
- The colours live in one place (CSS variables or one constants file) so they
  can be changed in a minute.
- The dot beside "Coming up" takes the colour of the most urgent row.
- Pairing, windows and the 2-hour drop-off do not change. Only the naming of
  the state inside the existing 15-minute and 2-hour marks changes.
- Remove the plain " · Due" / " · Overdue" suffixes.
- The time row itself (the line with the time) carries the tint, the badge and
  the blinking, so it shows whether the row is open or closed. A soon, due or
  late row opens by default, the person may close it and it keeps blinking, and
  it is never hidden behind "Show N more times".
- Reduced motion: no animation, the steady tint and badge remain.
- Tests: unit tests for the three states at their boundaries; a component test
  for each state's class and badge; a browser test that sees SOON for a
  medicine 5 minutes ahead and LATE for one 30 minutes past, at a phone and a
  tablet size. The blinking must not be lost again unnoticed.

### 8.2 Medicines given every few days get a start day

- Additive migration: `medicines.start_date date NULL`.
- Form: when "Every 2…7 days" is chosen, a third question appears: **"Which day
  does it start?"** (a date, today by default). Read-back: "Given every 3 days
  at 9:00 AM, starting Sunday, October 11. Next: Wednesday, October 14."
- Scheduling: such a medicine is scheduled like a daily one, but only on days
  where the number of calendar days since `start_date` is zero or a positive
  multiple of N. Nothing else in `buildUpcomingList` changes (pairing, due,
  late, windows). Calendar days in local time, safe across clock changes.
- Without a start day (older entries): not scheduled, as today. The cabinet
  card and the form say: "Pick a start day to see this under Coming up."
- The cabinet card shows the next day ("Every 3 days · next Wed, Oct 14").
- "Only when needed" is unchanged.
- Tests: unit tests for the day rule (start day, day N, day N−1, before the
  start, weekly, across a clock change, across midnight); a browser test: every
  2 days starting today with a time inside the next 12 hours shows under
  Coming up, starting tomorrow does not show today.

## 9. Batch M2b: a record knows which dose it is for, and missed doses stay visible

Owner's idea, 2026-10-11: when a dose is recorded late, ask the person about the
original dose. Built after M2a. This is the one batch that changes pairing, and
only by adding an explicit link that wins over the time match.

### 9.1 Stored data

- Additive migration on `medicine_logs`: `for_date date NULL` and `for_minute
  smallint NULL CHECK (for_minute BETWEEN 0 AND 1439)`; both set or both null.
  Together they name the scheduled dose in wall-clock terms ("Oct 11, 8:00 AM"),
  the same way slots are built from the medicine's times.
- Also `is_extra boolean NOT NULL DEFAULT false`: true only when the person
  chose "An extra dose, not on the schedule". It is what tells a deliberate
  extra dose apart from an older record that simply has no link.

### 9.2 Recording

- From a "Coming up" row, in any state: the record stores that row's
  `for_date` / `for_minute` automatically.
- If the row is late or missed (more than 15 minutes past its time) the sheet
  first asks: **"This dose was due at 8:00 AM. When was it given?"** with three
  choices and no default: "At 8:00 AM, on time" · "Just now" · "At another
  time" (date and quarter-hour). Save is enabled after a choice. Soon and due
  rows ask nothing; the time is now, rounded down, as today.
- From the "Record a medicine" list. Candidates are that medicine's scheduled
  doses, not yet recorded or skipped, from 12 hours ago to 2 hours ahead.
  - Exactly one candidate, and it is soon or due: link to it and ask nothing.
  - Otherwise, with at least one candidate, ask **"Which dose is this?"**: one
    choice per candidate ("The 8:00 AM dose, 2 hours late") plus "An extra
    dose, not on the schedule" (stored with `is_extra`).
  - No candidate: ask nothing, store no link, not extra.
- Never two questions for one record. A row under "Coming up" that is late or
  missed asks only "When was it given?". The list asks only "Which dose is
  this?"; the time is then now, with the sheet's existing Change control.

### 9.3 Pairing (the only rule that changes)

- A slot is satisfied by a record whose `for_date` / `for_minute` equal the
  slot, whatever time the record carries. A linked record never satisfies any
  other slot.
- A record marked `is_extra` never satisfies any slot.
- Records without a link keep today's rule (nearest free slot within 1 hour,
  one-to-one), applied to the slots and records that remain. Every existing
  pairing test must stay green unchanged.

### 9.4 Missed

- New state `missed`: an unrecorded slot more than 2 hours past its time stays
  under "Coming up" until 12 hours after its time, then leaves Today. Steady
  dark red, badge MISSED, no blinking. It is recorded like any other row.

### 9.5 Display

- "Given" stays grouped by the time the dose was given. Where that differs from
  the scheduled time, the line also says "due 8:00 AM". History the same.

### 9.6 Skipped on purpose (owner asked for it, 2026-10-11)

- A scheduled dose can be skipped on purpose. A skip is NOT a dose: it lives in
  its own table so that nothing that counts given doses (Given, History totals,
  reports, PDFs, "last given", Copy previous day) can ever count it.
- New table `dose_skips`: `id`, `household_id`, `medicine_id` (composite FK to
  `medicines` like `medicine_logs`), `for_date`, `for_minute` (the scheduled
  dose, both required), `reason text NOT NULL DEFAULT ''`, `caregiver_id`,
  `recorded_by`, `created_at`; unique on (household_id, medicine_id, for_date,
  for_minute). Same treatment as every data table: RLS `household_access`,
  explicit grants, the audit and ticker trigger, and it joins the table list of
  the isolation suite.
- Where: the dose sheet opened from a "Coming up" row (soon, due, late or
  missed) has a second action under Save: **"Skip this dose"**. It asks **"Why
  is it skipped?"**: Doctor's advice · Not needed · Refused · None left ·
  Other (free text, up to 80 characters); the reason may be left empty. It
  uses the same "Recorded by" person. Not offered for doses that are not on the
  schedule.
- Effect: a skip for a slot resolves that slot exactly like a linked record
  does, so the row leaves "Coming up" and never becomes MISSED. A slot with both
  a record and a skip counts as given.
- Display: in "Given · last 12 hours" the time group of the scheduled time
  shows a muted line "Skipped: Morning tablet (8:00 AM), doctor's advice, by
  Asha" with **Undo**. The History day view lists it the same way, separate
  from given doses. Undo deletes the skip; the row returns if its time is still
  inside the window.
- Reports and PDFs keep counting given doses only.

### 9.6b Not in this batch

Missed doses in History, skips in the PDF reports, reminders.

### 9.7 Tests

- Unit: a linked record 3 hours late clears its slot; an unlinked one does not;
  a linked record cannot clear a second slot; precedence of linked over
  unlinked; the missed window (2 hours to 12 hours); across midnight.
- Browser: a late row asks the question and "on time" stores the scheduled
  time; a missed row recorded "just now" leaves the list and shows under Given
  with "due …"; an extra dose from the list clears nothing; a skipped dose
  leaves "Coming up", shows as skipped with its reason, is not counted in the
  day's "meds given" or the medicine report, and Undo brings the row back.
- Isolation: `dose_skips` is covered by the same cross-family checks as the
  other data tables.
- Screens: the question sheet at a phone and a tablet size, both text sizes.

### 9.8 The owner's rule for everything in this batch: simple to understand, simple to operate

- Ask a question only when the answer is needed. A dose recorded on time asks
  nothing new. Never more than one extra question per record.
- Every choice is a large button with plain words; no jargon, no codes.
- One tap must be enough for the common case: on time → "At 8:00 AM, on time".
- If a screen needs explaining, the wording is wrong: fix the wording.

### 9.9 The app keeps itself up to date

People leave the app open for days (a bedside tablet, a home-screen icon), so
they never get a new version unless they reload by hand.

- Each build writes a `version.json` (the commit hash and build time) next to
  `index.html`; the running app knows its own version.
- The app checks `version.json` (no caching) when the tab becomes visible and
  every 10 minutes. If the version differs: when nothing is in progress (no
  open sheet, dialog or form with unsaved input, no recording or upload
  running) it reloads by itself; otherwise it shows a small bar "A new version
  is ready" with one button **Update now** and reloads as soon as the work in
  progress ends.
- A failed check does nothing. Local development and the e2e runs never reload.
- Tests: unit tests for the decision (same version, new version while idle,
  new version while busy, failed check); a browser test that a changed
  `version.json` reloads an idle page and shows the bar on a page with an open
  form.
