

# Add Appointment & Voice Note Upload Buttons to Quick Log

## What changes

### `src/components/QuickLogTab.tsx`
Add a "More Actions" section below the Medicines grid with two buttons in a 2-column layout:

1. **Appointment** (CalendarPlus icon, purple) — opens a Dialog with the appointment form fields (date, time, doctor name, reason, address, description). Uses `useAppointments` hook's `addAppointment` method.

2. **Voice Note** (Upload icon, indigo) — opens a Dialog with:
   - A title input field
   - A file upload button (accepts audio: .m4a, .mp3, .wav, .webm, .ogg, .flac, .mp4)
   - Shows selected file name
   - A "Process" button that calls `useTranscripts` hook's `processAudio` with the selected file
   - Shows a spinner while processing
   - No recording functionality — upload only

### Technical details
- Both hooks (`useAppointments`, `useTranscripts`) are imported directly into `QuickLogTab`
- Appointment dialog reuses the same form pattern from `AppointmentsTab` but as a standalone Dialog
- Voice note uses a hidden `<input type="file" accept="audio/*">` triggered by a button click
- The uploaded `File` object is passed directly to `processAudio(file, title, recorderName)` — the existing hook already handles `File` objects with proper extension detection
- No new files needed, no database changes

