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
