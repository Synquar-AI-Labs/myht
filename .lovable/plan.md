

# Dad's Health Tracker 🩺

A simple, elegant, mobile-first app to track your dad's daily health and manage medical appointments — accessible to the whole family via a shared link.

---

## Design & Feel
- **Warm neutral palette** — soft grays, warm beige/cream tones, gentle accent color
- **Mobile-first** layout optimized for phone use
- **Clean, minimalistic** with large touch targets and readable fonts
- **No login required** — anyone with the link can access

---

## Three Main Tabs (bottom navigation on mobile)

### Tab 1: Dashboard 📊
- **Date range selector** (last 7 days, 30 days, custom)
- **Line/bar charts** showing trends for:
  - Weight over time (line chart)
  - Feed bags per day (bar chart)
  - Blood pressure over time (line chart with systolic/diastolic)
  - Stool count per day (bar chart)
- **Quick status cards** at the top showing today's summary (last entry)
- Simple, glanceable — no clutter

### Tab 2: Daily Record Entry 📝
- **Today's entry form** with these fields:
  - **Feed bags** — number input (bags of liquid diet)
  - **Weight** — number input (kg or lbs)
  - **Blood pressure** — two fields (systolic / diastolic)
  - **Food taken** — Yes/No toggle + optional description text
  - **Stool passed** — Yes/No toggle + number input for count
  - **Vomiting** — Yes/No toggle
  - **Constipation** — Yes/No toggle
- **"Copy from previous day"** button — pre-fills the form with the last entry's values for quick editing
- **Entry history list** below the form — scrollable list of past entries with date and key stats
- Ability to edit past entries by tapping on them

### Tab 3: Appointments Calendar 📅
- **Monthly calendar view** with dots on days that have appointments
- **Tap a date** to see/add appointments
- **Appointment details:**
  - Date & time
  - Doctor name
  - Address
  - Reason for visit
  - Optional description/notes
- **Upcoming appointments list** below the calendar sorted by nearest date

---

## Email Reminders (Backend Feature)
- **Daily update reminder** — if no health entry is logged by a set time (e.g., 8 PM), send a reminder email to configured family email addresses
- **Appointment reminder** — send an email 1 day before each upcoming appointment
- Configurable email addresses in a simple **Settings page** (accessible via a gear icon)
- *This requires a Supabase backend for storing data and scheduling email reminders*

---

## Data Storage
- All health records and appointments stored in a **Supabase database** (Lovable Cloud)
- This ensures data persists and is accessible from any device

---

## Pages Summary
1. **Main app** with 3 tabs (Dashboard, Daily Record, Calendar)
2. **Settings page** — configure reminder email addresses
3. **Mobile bottom navigation** for tab switching

_________
the dashboard should show the visuals for all of the below :
Feed bags — number input (bags of liquid diet)
Weight — number input (kg or lbs)
Blood pressure — two fields (systolic / diastolic)
Food taken — Yes/No toggle + optional description text
Stool passed — Yes/No toggle + number input for count
Vomiting — Yes/No toggle
Constipation — Yes/No toggle

