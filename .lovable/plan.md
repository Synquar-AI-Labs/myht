

# Hospital Stay Scheduling Tab

## Overview
Add a new "Stays" tab for coordinating who is staying with Dad at the hospital. Week-view calendar with color-coded bars per person, plus the ability to mark yourself as "unavailable" (shown as striped/hatched bars).

## 1. Database Migration

**New table: `hospital_stays`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default `gen_random_uuid()` |
| person_name | text | NOT NULL |
| date | date | NOT NULL |
| start_hour | integer | NOT NULL, 0-23 |
| end_hour | integer | NOT NULL, 1-24 (exclusive) |
| is_unavailable | boolean | NOT NULL, default false |
| created_at | timestamptz | default now() |

- RLS enabled with authenticated user policies for SELECT, INSERT, UPDATE, DELETE (same pattern as existing tables).

## 2. New Files

### `src/hooks/useHospitalStays.ts`
- Fetch stays for a given week (date range filter)
- Add stay (person, date, start_hour, end_hour, is_unavailable)
- Delete stay by id
- Uses `@tanstack/react-query` with invalidation on mutations (same pattern as `useAppointments`)

### `src/components/StayFormSheet.tsx`
- Bottom drawer (Vaul `Drawer`) for adding a stay
- Fields:
  - **Person picker**: Select from Fahad, Shahwar, Umair, Affan, Azra, Nayab
  - **Date**: Pre-filled from tapped day, editable
  - **Start hour / End hour**: Select dropdowns (6 AM - 11 PM range)
  - **Status toggle**: "Staying" (default) vs "Unavailable" -- controls `is_unavailable` boolean
- Save button inserts row and closes sheet

### `src/components/HospitalStaysTab.tsx`
- **Week navigation**: Shows "Mon Feb 16 - Sun Feb 22" with Prev/Next buttons
- **Grid layout**: 7 rows (Mon-Sun), each row:
  - Left label: day name + date (e.g. "Mon 17")
  - Right area: horizontal timeline from 6 AM to 12 AM (18 hours)
  - Color bars positioned proportionally for each person's stay
  - **Unavailable bars**: Same person color but with a striped/hatched CSS pattern (diagonal lines via `repeating-linear-gradient`) and a small "Unavailable" label
  - **Staying bars**: Solid color with person's name
- Tap on a day row opens the `StayFormSheet` with that date pre-selected
- Tap on an existing bar shows a delete option (small X or confirm dialog)

### Person Color Map
| Person | Color |
|--------|-------|
| Fahad | #3B82F6 (blue) |
| Shahwar | #22C55E (green) |
| Umair | #F97316 (orange) |
| Affan | #A855F7 (purple) |
| Azra | #EC4899 (pink) |
| Nayab | #14B8A6 (teal) |

### Unavailable Visual Treatment
- Uses the person's color but with a diagonal stripe pattern:
  ```css
  background: repeating-linear-gradient(
    45deg,
    {color}33,
    {color}33 4px,
    {color}66 4px,
    {color}66 8px
  );
  border: 1px dashed {color};
  ```
- Text inside reads "Unavailable" in smaller font

## 3. Changes to Existing Files

### `src/types/health.ts`
- Add `STAY_PEOPLE` constant:
  ```typescript
  export const STAY_PEOPLE = ['Fahad', 'Shahwar', 'Umair', 'Affan', 'Azra', 'Nayab'] as const;
  ```

### `src/pages/Index.tsx`
- Add `'stays'` to the `Tab` union type
- Add new tab entry with `Users` icon from lucide-react, label "Stays"
- Render `<HospitalStaysTab />` when `activeTab === 'stays'`
- Bottom nav now has 5 tabs

## 4. Technical Details

- Week boundaries calculated with `date-fns` (`startOfWeek` with `weekStartsOn: 1` for Monday, `endOfWeek`, `addWeeks`, `eachDayOfInterval`)
- Single Supabase query per week: `.select('*').gte('date', weekStart).lte('date', weekEnd)`
- Bar positioning: `left = ((start_hour - 6) / 18) * 100%`, `width = ((end_hour - start_hour) / 18) * 100%`
- The timeline area scrolls horizontally on narrow screens if needed
- Multiple people on the same day stack vertically within the row (each bar on its own sub-row)

