

## Medicine Schedule Tab — Implementation Plan

### Summary
Add a new "Meds" tab with a mobile-optimized medicine schedule manager, and populate it with the existing schedule from the caregiver chart image.

### 1. Database Migration — Alter `medicines` table

Add columns to the existing `medicines` table (all with defaults so existing data stays intact):

| Column | Type | Default | Example |
|--------|------|---------|---------|
| `potency` | text | `''` | "1mg", "12mg" |
| `amount` | text | `''` | "1.5 pills", "2 pills" |
| `med_type` | text | `''` | "Pain Killer", "Anti-Nausea" |
| `category` | text | `'medicine'` | "medicine", "non-medicine" |
| `schedule_time` | text | `''` | "10:00 AM" |
| `frequency` | text | `'daily'` | "daily", "every 2 days", etc. |

### 2. Populate Existing Medicines

Update all existing records with the new fields based on the caregiver chart. Key schedule entries from the image:

| Medicine | Potency | Amount | Type | Time(s) | Frequency |
|----------|---------|--------|------|---------|-----------|
| Hydromorphone | 1mg | 1.5 pills | Pain Killer | Every 5hrs | daily |
| Metoclopramide | — | 2 pills | Digestive | Every 8hrs | daily |
| Olanzapine 2.5mg | 2.5mg | 1 pill | Psych | 8:00 AM | daily |
| Olanzapine 12mg (new) | 12mg | 1 pill | Psych | 8:00 PM | daily |
| Ondansetron | 4mg | 1 pill | Anti-Nausea | Every 12hrs | daily |
| Levothyroxine | 88mcg | 1 pill | Thyroid | 9:00 AM | daily |
| Apixaban | 5mg | 1 pill | Blood Thinner | 10AM/9PM | daily |
| Cotazym | 85000U | 1 pill | Digestive | 10AM/9PM | daily |
| Empagliflozin | — | 1 pill | Diabetes | 10:00 AM | daily |
| Linagliptin | 5mg | 1 pill | Diabetes | 10:00 AM | daily |
| Pregabalin 50mg | 50mg | 2 pills | Nerve Pain | 10AM/9PM | daily |
| Lenvatinib | 12mg | 3 pills | Cancer | 8:00 PM | daily |
| Sennosides | 8.6mg | 2 pills | Digestive | 9:00 PM | daily |
| Acetaminophen | 500mg | 2 pills | Pain Relief | As needed | as needed |

### 3. New Component: `MedicineScheduleTab.tsx`

Mobile-first (390px) card-based UI:
- **List view**: Cards grouped by type, showing name, potency × amount, schedule time, frequency badge
- **Add button**: Floating "+" to open a Sheet form with all fields (name, potency, amount, type dropdown, category toggle, time picker, frequency dropdown)
- **Edit**: Tap card to open same form pre-filled
- **Delete**: Swipe or trash icon on each card
- **Schedule notes**: Display the medication notes from the image (interaction warnings like "2hr gap from Olanzapine & Ondansetron")

### 4. Hook: `useMedicineSchedule.ts`

CRUD operations on the `medicines` table using the new columns. Separate from the existing `useMedicines` hook which handles daily logging.

### 5. Navigation Update

Add 7th tab: `{ id: 'meds', label: 'Meds', icon: Pill }` to `Index.tsx`.

### Files to create/edit
1. **SQL migration** — ALTER TABLE medicines ADD COLUMN × 6
2. **Data population** — UPDATE medicines SET potency, amount, etc. for each existing record; INSERT new Olanzapine 12mg
3. **`src/components/MedicineScheduleTab.tsx`** — New component
4. **`src/hooks/useMedicineSchedule.ts`** — New hook
5. **`src/pages/Index.tsx`** — Add Meds tab

