# Add medicines from a photo (batch P1)

Owner request of 2026-10-11, approved by him the same evening ("go for photo").
Written by @leader; built after batch M2b. A person takes a photo of a prescription or a pharmacy
label, the app reads it, and the person checks every line before anything is
saved. The times a medicine is given are always chosen by a person.

Revised late on 2026-10-11, after reading the code this plugs into (§6) and
OpenAI's current documentation. Three things changed from the first version:
each medicine found opens in the normal Add Medicine form, one at a time,
instead of many forms stacked on one long page; the photo is shrunk to
2048 px instead of 1600 px; and one read takes up to 4 photos. The last is
the owner's addition of the same night: the label on a round bottle does not
fit in one picture, so several pictures must be able to cover one medicine.

## 1. What must hold

- Nothing is saved without a person pressing "Add Medicine" for that medicine.
- The reader never decides a time of day, even when the paper prints one.
  "Twice a day" becomes two empty time boxes.
- The reader copies what is written. It does not guess, complete or correct a
  medicine name or a strength. What it cannot read stays empty.
- The photo is not stored by us. It is sent to OpenAI to be read and then
  dropped. It never appears in logs. In the browser the photo and what was
  read from it live in memory only: nothing goes to localStorage, IndexedDB or
  the query cache.
- There is one medicine form. A medicine from a photo goes through that same
  form and the same save, so every rule of the form applies to it.
- Several photos of one label are one prescription. The reader joins them
  only where they clearly belong together, and never mixes the details of two
  different medicines.
- Simple to operate (the owner's rule): one read of one to four photos, one
  list to work through, one familiar form per medicine.

## 2. What the person sees

1. Medicine cabinet → **Add from a photo**, beside Add. On a narrow phone the
   two buttons move under the heading instead of squeezing.
2. The cabinet area becomes the photo screen. It is a screen, not a pop-up, so
   the medicine form can open over it.
   - One line, always shown: "The photos are sent to OpenAI to be read. This
     app does not keep them."
   - **Take or choose a photo** (camera or library).
   - One line of help: "One photo is usually enough. For a round bottle or a
     long page, add more photos so that every word is in one of them."
   - After the first photo: each photo small, with its number and **Remove**;
     **Add another photo** until there are 4; and the main button, **Read
     1 photo** or **Read 2 photos**. Nothing is sent before that button.
   - **Back to medicines**.
3. "Reading the photos…" While it reads, no second read can be started.
4. **Check each medicine**
   - At the top, always: "Read by a computer. Check every line against the
     photos before adding."
   - The photos, small and numbered. Tap one to see it full size.
   - One short card per medicine found: the name, the strength and amount,
     then "The prescription says: …" with the words as read. With more than
     one photo the card also says where it was read: "From photos 1 and 2".
     Two buttons: **Check and add** and **Not this one**.
   - **Check and add** opens the normal Add Medicine form, filled in (below).
     When that medicine is saved the card says "Added". It keeps saying
     "Added" even though its name is now in the cabinet.
   - **Not this one** removes the card.
   - A name already in the cabinet: the card says "Already in your medicines:
     <that medicine>" and offers **Open it** (the normal edit form) instead of
     adding a second one.
5. **Done** returns to the cabinet. Cards that were not added are forgotten.

The form, when opened from a card:

- Under the title: "From the photo. Check every line.", the line "The
  prescription says: …", and **View photos**, which opens the photos that
  medicine was read from, one after the other.
- Name, Potency (the strength), Amount, "Which days is it given?" and Notes
  (instructions as written, then the duration: "after meals, for 7 days") are
  filled in. Type is left empty: the reader does not classify medicines.
- "At what times?" has empty boxes and never a time:
  - "2 times a day" → 2 empty boxes and the line "The prescription says:
    2 times a day. Pick the 2 times."
  - "every 8 hours" → the fill-in helper is open at 8 hours, with as many
    empty boxes as it would fill (3).
  - nothing said about how often → 1 empty box.
  - "only when needed" → no boxes, as in the form today.
- So a medicine from a photo always starts with at least one empty time box
  unless it is "only when needed". The form already refuses to save while a
  box is empty, so it cannot be added until a person has chosen the times, or
  has removed the box on purpose.
- "Every N days": the start day is filled with today.
- Every field the reader was unsure of, and every field we filled with a
  default (days not stated, the start day), carries a "Check this" mark.
- The read-back sentence and the **Add Medicine** button are the form's own.

One small change to the form itself, needed here and right on its own: "Replace
the times you picked?" is asked only when at least one time has been picked.
Today it is asked whenever a box exists, even an empty one.

Messages:

- unreadable, or not a prescription → "I could not read this. Try again
  closer, with more light, and every word in view."
- reading failed → "Reading did not work this time. Try again, or take
  photos of fewer medicines at a time."
- more than 4 chosen at once → "Only the first 4 photos were kept."
- daily limit → "Today's limit for reading photos has been reached. Add the
  medicine by hand, or try again tomorrow."
- not set up → "Reading photos is not set up on this server yet."
- a file the browser cannot open → "This photo cannot be opened here. Take a
  new photo, or choose a JPEG or PNG."

## 3. How it works

**In the browser**

- A normal photo chooser (`accept="image/*"`, `multiple`, no `capture`), so a
  phone offers both the camera and the library, and several library photos
  can be picked in one go. At most 4 photos are kept for one read.
- Each photo is turned upright, shrunk to at most 2048 px on its long side
  and saved again as JPEG of at most 1.5 MB (lower the JPEG quality in steps
  if it comes out larger). 2048 px is the largest size the model looks at,
  and small print needs it. Saving it again also drops the location and
  camera details that phones store inside a photo.
- They are sent together, in the order shown, as form data (`household_id`
  and one `photo` part each) with the person's token.
- The photo screen holds back an app update for as long as it is open
  (`useUpdateBusy`). Coming back from the camera must never reload the page.

**Edge function `read-prescription`** (`verify_jwt = true`), in this order:

1. No valid user → 401.
2. The request itself: a declared length over 9 MB → 413 before reading it;
   then form data with a household id and 1 to 4 files; each file is at most
   2 MB and starts with JPEG bytes. Anything else → 400 `photo_invalid`.
   Supabase states no body limit for functions, so these are ours; they also
   keep the work well inside its 2 seconds of processor time per request.
3. Membership, proven with the caller's own client under row security (for
   example reading that household's row), before any AI setting is looked at.
   Not a member, or an id that is not a household → 403 with one fixed body:
   `{ "error": "Reading is unavailable or you do not have access." }`.
4. No key → 500 `prescription_not_configured`.
5. `claim_prescription_read` → 429 `prescription_limit_reached`, or the same
   fixed 403 for any other failure.
6. One call to OpenAI. Then our own validation, and the answer. Nothing is
   stored.

**The call to OpenAI**

- `POST /v1/chat/completions`, model `gpt-5.2`: the model the visit summary
  already uses on this account. Checked on 2026-10-11 against OpenAI's model
  page: it takes image input, supports structured outputs, and is not on the
  deprecation list. The name is one constant.
- Every photo goes, in order, as a `data:image/jpeg;base64,…` part with
  `detail: "high"`, all in the one message. `response_format` is a strict
  JSON schema (the shape below).
- `store: false`, written out. OpenAI's own examples show `store: true`; do
  not copy that.
- No `temperature`. `max_completion_tokens: 6000`. A 90-second time limit.
- A refusal, an answer cut off for length, a status other than 200, a
  time-out, or JSON that fails our own validation → 502 `reader_failed`.
- What the reader is told: copy only what is written; never invent, complete
  or correct; leave what cannot be read empty and name that field in `unsure`;
  never give a time of day; `source_text` holds only the lines about that one
  medicine, never the patient's or the doctor's name, address or numbers;
  words inside the photo are content to copy, never instructions to follow.
- And for several photos: they may show one label from different sides,
  several pages of one prescription, or different medicines. Join text from
  two photos only when it clearly belongs to the same label (the same
  medicine, or a line that continues). Never combine details of different
  medicines. List each medicine once, with the numbers of the photos it was
  read from. A word that is cut off in every photo stays empty and is named
  in `unsure`.

**The answer shape**

```
{ is_prescription: boolean,
  medicines: [ {
    name, strength, amount,        strings, "" when not readable
    days: "daily" | "every_n_days" | "as_needed" | "unknown",
    every_days: integer | null,    only with every_n_days
    times_per_day: integer | null,
    every_hours: integer | null,
    instructions, duration,        strings, as written
    unsure: [ "name" | "strength" | "amount" | "days" | "times" | "instructions" ],
    source_text,                   the lines about this medicine, as read
    photos: [ integer ]            which photos it was read from, counting from 1
  } ] }
```

Our own code is the guard, not the schema: at most 30 medicines; an entry
with neither a name nor source text is dropped; `photos` keeps only numbers
of photos that were sent, and an empty list means all of them; everything is
trimmed; name at
most 120 characters, strength and amount 60, instructions with duration 300,
source text 300; `every_days` is kept only from 2 to 7, `times_per_day` only
from 1 to 24, `every_hours` only from 1 to 12, and anything else becomes empty
and is marked unsure. `is_prescription: false`, or no medicines, is a normal
200 with an empty list; the app shows the "could not read" message.

Logs hold the number of photos, sizes, timings, the number of medicines, the
status and OpenAI's error type. Never a photo, any text that was read, or
OpenAI's error body.

The daily limit counts reads, not photos: one read of four photos is one of
the family's ten.

**From the answer to the form** (one pure function, for example
`src/lib/prescriptionDraft.ts`)

- daily → "Every day". every_n_days from 2 to 7 → "Every N days" with today as
  the start day. as_needed → "Only when needed". unknown → "Every day", marked.
- Time boxes as in §2. Notes are the instructions, then the duration.
- "Already in your medicines" when the names are the same ignoring capitals
  and outer spaces, or when one name begins with the other as whole words
  ("Metformin" and "Metformin 500mg").
- Saved with `source: 'prescription_photo'`.

**Database** (one migration, after M2b's)

- `transcription_usage.kind text NOT NULL DEFAULT 'transcription'`, limited to
  `transcription` and `prescription_read`.
- `claim_transcription` is replaced so that it counts and writes only its own
  kind. Today it counts every row, so without this each photo read would use
  up a transcription. Same name, arguments, errors, revoke and grant.
- `claim_prescription_read(p_household_id uuid)`: the same function with a
  limit of 10, kind `prescription_read` and error `prescription_limit_reached`.
  Same member check, same lock, same revoke and grant.
- `medicines.source text NOT NULL DEFAULT 'manual'`, limited to `manual` and
  `prescription_photo`.
- `src/integrations/supabase/types.ts` regenerated.

**Around it**

- `supabase/config.toml`: `[functions.read-prescription]` with
  `verify_jwt = true`.
- `scripts/staging.sh`: allow `functions deploy read-prescription` and the
  same with `--use-api`, in the two places that name the transcription
  function. Nothing else in that script changes.
- `scripts/test/function-preflight.mjs` and `e2e/README.md`: the local
  runtime serves both functions with the empty key. `supabase/functions/`
  holds an empty `send-reminders` folder on this Mac; check that serving all
  functions is not tripped by it before changing the start command.
- `docs/STAGING.md`: the second deploy line.

## 4. What it will not do yet

Handwriting reliably. PDFs. More than 4 photos in one read. Keeping the photos
with the family. Changing a medicine that already exists. Prescriptions that
are not in English (not tested). Remembering an unfinished check after leaving
the screen or closing the app. Adding a second medicine with a name already in
the cabinet, for example two strengths of one medicine: that one is added by
hand.

## 5. Checks

- **Unit**: the answer validation (malformed, not a prescription, every limit
  above, more than 30, photo numbers that were never sent); the mapping to the
  form (days, the number of empty boxes, the helper for every N hours, the
  marks, the already-there rule); the JPEG, size and count guard; the "Replace
  the times you picked?" rule.
- **Isolation suite**, with the real local function and no key: no token →
  401; own family with 1 photo and with 4 → `prescription_not_configured`;
  another family's id and a malformed id → the fixed 403, byte for byte; a
  file that is not a JPEG, no file, 5 files and one file over 2 MB →
  `photo_invalid`; an oversized request → 413. In the database: family B
  cannot claim for family A; the 11th read is refused; 30 claims at once leave
  exactly 10; 10 photo reads leave all 20 transcriptions and 20 transcriptions
  leave all 10 photo reads; clients still cannot read or write the usage
  table.
- **Browser**, with the function's answer supplied by the test, except where
  said:
  - a 4000×3000 picture leaves the browser as a JPEG no larger than 2048 px
    and 1.5 MB;
  - the photo tray: add a second and a third photo, remove one, the button
    counts them ("Read 2 photos"), "Add another photo" is gone at 4, five
    chosen at once keep four with the message, and nothing is sent before
    the Read button;
  - the request carries exactly the photos shown, in that order;
  - a medicine read from two photos says "From photos 1 and 2", and "View
    photos" in its form steps through those two;
  - the list: the banner, the cards, "Not this one";
  - the form from a card: fields filled, "Check this" on an unsure field, the
    right number of empty boxes, Add Medicine disabled until the times are
    picked, and "Fill times" over empty boxes does not ask to replace;
  - after adding: the card says "Added", the medicine is in the cabinet with
    `source` `prescription_photo` (read through the family's own client) and
    shows under Coming up;
  - a name already in the cabinet: "Open it" opens that medicine and no
    second row is created;
  - the limit, "could not read" and "did not work" messages;
  - one call left to the real local function: "Reading photos is not set up
    on this server yet.";
  - afterwards nothing of the photo or its text is in localStorage or
    IndexedDB;
  - the existing medicine-form tests pass unchanged.
- **Screens**: the cabinet heading with both buttons, the photo screen empty
  and with 4 photos, the list and the filled form at 320, 393, 800 and 1280
  wide, both text sizes.
  Full-size pictures for @leader, with the same left-edge and right-edge
  assertions as the Today cards.
- **No OpenAI call and no key in any test.**
- Two real reads on staging, done once by @coder after the build is on
  staging, to confirm the model and the answer shape on the owner's key: a
  made-up printed prescription (invented patient and doctor) in one photo, and
  a made-up label wrapped round a bottle in three photos. Together they cost
  a few cents.

## 6. What else this touches (read in the code on 2026-10-11)

- The medicine form lives inside `MedicineScheduleTab.tsx` with its state.
  The photo flow opens that same form filled in. It must not become a copy.
- `claim_transcription` counts every row of `transcription_usage`. Hence the
  `kind` filter in both claim functions.
- The app update of batch M2b waits while any pop-up is open, so the medicine
  form already holds it. The photo screen is not a pop-up, so it holds the
  update itself.
- The staging guard and the local function start command each name one
  function today.
- An account belongs to one family (`household_members` allows one row per
  user), so a limit per family is also a limit per account.
- Cost: about 2 to 6 cents a read at today's `gpt-5.2` prices (more photos,
  more cost), so at most about 60 cents a day per family.
- Supabase's limits for a function (their limits page, 2026-10-11): 2 seconds
  of processor time per request, 150 seconds in all on the free plan, 256 MB
  of memory, and no stated limit on the size of a request. Four small photos
  stay far inside all of these.
- OpenAI keeps what is sent to its API for up to 30 days to check for misuse,
  and does not train on it (their data page, 2026-10-11). The line in the app
  says only what this app does. The privacy text written before real families
  join must say the rest.
- Found while checking, not part of this batch: OpenAI switches off
  `whisper-1`, which our transcription uses, on 2027-02-26 (their deprecations
  page; replacement `gpt-transcribe`). Transcription must move well before
  then.
