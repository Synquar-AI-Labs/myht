
# Medicine Tracking Feature

## Overview
Add a medicine tracking section to the daily record page. Users can log which medicines were taken, at what time, and manage a custom medicine list.

## Medicine List (Pre-loaded)
The following 18 medicines will be available in alphabetical order:
1. Acetaminophen 325mg - Pain as needed
2. Apixaban 5mg (Blood thinner) - Day and Night
3. Apo-Levothyroxine 75mcg (Thyroid) - Day
4. Cotazym 85000U - As needed
5. Hydromorphone 1mg - As needed
6. Hydromorphone 3mg - As needed
7. Jamp-Senna 8.6mg Sennosides - Day + Night
8. Jardiance 10mg - Night
9. Metoclopramide - As needed (6hr, max 4/day)
10. Olanzapine 2.5mg - As needed (6hr, max 4/day)
11. Ondansetron 8mg - As needed
12. Pregabalin 25mg - Night
13. Pregabalin 50mg - Day
14. Pregabalin 75mg - Night
15. Ramipril 10mg (Blood Pressure) - Day
16. Taro-Docusate 100mg - Day + Night
17. Teva-Loperamide 2mg - Diarrhea as needed
18. Trajenta 5mg - Night

## Database Changes

### Table 1: `medicines` (master list)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| name | text | e.g. "Hydromorphone 1mg" |
| schedule_note | text | e.g. "As needed", "Day + Night" |
| created_at | timestamptz | Auto |

Pre-seeded with the 18 medicines above. Users can add new ones.

### Table 2: `medicine_logs` (daily tracking)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| date | date | Which day |
| medicine_id | uuid | FK to medicines |
| hour | integer | 1-12 |
| am_pm | text | "AM" or "PM" |
| recorded_by | text | Who logged it |
| created_at | timestamptz | Auto |

RLS policies: same pattern as existing tables (authenticated users can CRUD).

## Frontend Changes

### 1. New component: `MedicineTracker.tsx`
- Displayed inside `DailyRecordTab` below the health form
- Shows medicines logged for the current `viewDate`
- Each logged entry shows: medicine name, time (e.g. "8 AM"), with edit/delete buttons
- "Add Medicine" button opens a form with:
  - Dropdown (Select) of all medicines sorted alphabetically, showing name + schedule note
  - Hour selector (1-12)
  - AM/PM toggle
  - "Recorded By" selector (reuses existing RECORDER_OPTIONS)
- "Add New Medicine" option at bottom of dropdown opens a small dialog to add a custom medicine name + schedule note to the master list

### 2. New hook: `useMedicines.ts`
- Fetches master medicine list from `medicines` table
- Fetches medicine logs filtered by date
- Functions: `addMedicineLog`, `deleteMedicineLog`, `updateMedicineLog`, `addNewMedicine`

### 3. Auto-copy behavior
- When navigating to a new day that has no medicine logs, offer to copy the previous day's medicine entries (same as existing "Copy Previous" pattern)

### 4. Updates to `DailyRecordTab.tsx`
- Import and render `MedicineTracker` component, passing the current `viewDate`

## Technical Details

- Two new database tables with migrations and RLS policies
- Seed the `medicines` table with the 18 medicines via the migration
- New `useMedicines` hook following the same pattern as `useHealthRecords`
- New `MedicineTracker` component with Select dropdown, time pickers, and CRUD operations
- Zod validation for medicine log entries
- No changes to existing health record logic -- medicine tracking is additive
