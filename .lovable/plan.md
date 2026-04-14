

# Quick Log Switchboard Tab

## Overview
A new "Quick Log" tab that acts as a switchboard — a grid of tappable buttons for rapidly logging medicines, health events (feed, BP, vomit, poop, urin), and weight. Includes a today's summary strip at the top and a compact weekly mini-chart.

## No Database Changes
All data writes go to existing tables: `medicine_logs`, `health_records`. No new tables needed.

## New Files

### `src/components/QuickLogTab.tsx`
The main switchboard component with these sections:

**1. Today's Summary Strip**
A row of cards showing today's totals pulled from `health_records` (today's row) and `medicine_logs` (today's count):
- Feeds: count | BP: latest | Vomit: count | Poop: count | Flushes: count

**2. Medicine Quick Buttons**
A grid of buttons (3-4 per row), one per medicine from the `medicines` table. Each button shows the medicine name and schedule note. Tapping a button:
- Shows a small bottom sheet with: recorder name picker (pre-filled if previously set), time defaulting to NOW (hour + AM/PM), and option to change the time
- Confirm logs to `medicine_logs`
- Button gets a subtle checkmark/badge showing how many times it was logged today

**3. Health Event Quick Buttons**
A row of colored buttons: Feed, BP, Vomit, Poop, Urin, Weight, Flush. Each opens a mini popup:
- **Feed**: number input for bag count
- **BP**: two fields (systolic/diastolic)
- **Vomit/Poop/Urin**: count input (defaults to 1)
- **Weight**: number input
- **Flush**: count input
These update today's `health_records` row (upsert pattern matching existing `addRecord` logic — fetch current row, merge the new value, save).

**4. Compact Weekly Mini-Chart**
A small 7-day bar chart (reusing recharts) showing feeds, vomits, poop, flushes per day — similar to the wireframe's right-side weekly view.

### `src/components/QuickLogSheet.tsx`
A reusable bottom sheet (Vaul Drawer) for the quick-log popups:
- Medicine mode: shows recorder picker + time (default now, editable)
- Health mode: shows the specific input fields for the tapped metric + recorder picker

## Changes to Existing Files

### `src/pages/Index.tsx`
- Add `'quicklog'` to the `Tab` union
- Add tab entry with `Zap` icon from lucide, label "Quick Log"
- Render `<QuickLogTab />` when active
- 6 tabs total in bottom nav

### `src/hooks/useHealthRecords.ts`
- Add an `updateField` method that fetches today's record, merges a single field update, and upserts. This avoids overwriting the entire record when the user only taps "Feed +1".

## UI Details
- Medicine buttons: compact rounded rectangles in a 3-column grid, showing medicine name (truncated if long) and a small badge with today's log count
- Health buttons: larger, color-coded (Feed=blue, BP=red, Vomit=orange, Poop=brown, Urin=yellow, Weight=green, Flush=cyan)
- The recorder name persists in localStorage so users don't re-select each time
- Bottom sheet is minimal: just the essential fields + Save button

## Technical Flow
```text
User taps "Hydromorphone" button
  → Bottom sheet opens
  → Shows: Recorder [dropdown], Time [12:30 PM] (editable)
  → User taps Save
  → Inserts into medicine_logs {medicine_id, hour, am_pm, recorded_by, date: today}
  → Button badge updates to show count
  → Sheet closes
```

