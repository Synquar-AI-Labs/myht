

## Medicine Time Alert — Flashing Indicators (Programmatic)

### Summary
Make medicine buttons in the Quick Log tab flash/pulse when the current time matches their scheduled time, giving caregivers a visual nudge.

### How it works

1. **Parse `schedule_time`** from each medicine record (e.g. "10:00 AM", "9:00 PM", "10:00 AM / 9:00 PM")
2. **Compare against current time** with a ±30 minute window (configurable) — if current time is within that window, the medicine is "due"
3. **Check today's logs** — if the medicine has already been logged for that time slot today, stop flashing
4. **Apply a CSS pulse animation** to the medicine button in the Quick Log

### Time parsing rules
| `schedule_time` value | Parsed as |
|---|---|
| `10:00 AM` | Single alert at 10:00 |
| `10:00 AM / 9:00 PM` | Two alerts |
| `Continuous`, empty, or unparseable | No flashing (skip) |

### Technical details

1. **New utility function** `getUpcomingMedicines(medicines, logs, currentTime)` — returns Set of medicine IDs that are currently due
2. **Timer in QuickLogTab** — `setInterval` every 60 seconds to re-evaluate which medicines are due
3. **CSS animation** — add `animate-pulse` + colored ring to due medicine buttons
4. **Already-logged check** — if a medicine_log exists for today with an hour/am_pm matching the schedule window, it's considered taken and stops flashing

### Files to create/edit
1. **`src/lib/medicineAlerts.ts`** — Time parsing + due-check utility
2. **`src/components/QuickLogTab.tsx`** — Add timer, apply flash styles to due medicines

### No database changes needed
All data already exists in the `medicines.schedule_time` column and `medicine_logs` table.

