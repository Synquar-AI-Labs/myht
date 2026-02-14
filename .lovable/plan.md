

## Audio Transcript Feature

A new "Transcripts" tab where you can record or upload doctor conversations, get AI-powered summaries with action items, and view the full transcript.

### How It Works

1. You record audio directly in the app (via microphone) or upload an audio file
2. The audio is sent to OpenAI Whisper for transcription
3. The transcript is then sent to ChatGPT for analysis, producing:
   - Executive summary
   - Things to do (action items)
   - Things to follow up on
   - Full conversation text
4. Everything is saved to the database -- multiple entries per day allowed

### What Will Be Built

**1. Database Table: `audio_transcripts`**
- id, date, title (optional label), audio_url (stored in file storage), transcript (full text), summary (executive summary), action_items (JSON array), follow_ups (JSON array), recorded_by, created_at
- RLS policies matching existing shared-access model
- Storage bucket for audio files

**2. API Key Setup**
- You will be prompted to enter your OpenAI API key, which will be stored securely as a backend secret (`OPENAI_API_KEY`)

**3. Edge Function: `transcribe-audio`**
- Receives uploaded audio file
- Calls OpenAI Whisper API (`/v1/audio/transcriptions`) to get the transcript
- Calls ChatGPT (`/v1/chat/completions`) to generate: executive summary, action items, and follow-ups
- Returns structured results to the client

**4. New UI Tab: "Transcripts" (Mic icon)**
- Added as a 4th tab in the bottom navigation
- **Record mode**: Hold-to-record or tap-to-start/stop using the browser MediaRecorder API
- **Upload mode**: File picker for audio files (mp3, wav, m4a, webm)
- **Processing state**: Shows a spinner while transcribing and analyzing
- **Transcript card**: Displays each entry with collapsible sections:
  - Executive Summary (shown by default)
  - Things To Do (checklist-style)
  - Things To Follow Up (list)
  - Full Transcript (collapsed by default)
- **List view**: All transcripts for the selected date, with delete option

**5. Hook: `useTranscripts.ts`**
- Fetches transcripts from database
- Handles audio upload to storage bucket
- Calls the edge function for processing
- CRUD operations

### Technical Details

**Database migration SQL:**
- Create `audio_transcripts` table with columns: id (uuid), date (text), title (text), audio_url (text), transcript (text), summary (text), action_items (jsonb), follow_ups (jsonb), recorded_by (text), created_at (timestamptz)
- Create storage bucket `audio-files` (public: false)
- RLS policies: authenticated users can SELECT, INSERT, DELETE (matching existing shared model)

**Edge function: `supabase/functions/transcribe-audio/index.ts`**
- Reads `OPENAI_API_KEY` from environment
- Step 1: POST audio to `https://api.openai.com/v1/audio/transcriptions` with model `whisper-1`
- Step 2: POST transcript to `https://api.openai.com/v1/chat/completions` with model `gpt-4o-mini` and a system prompt that returns JSON with `summary`, `action_items[]`, `follow_ups[]`
- Returns the combined result

**New files:**
- `src/components/TranscriptsTab.tsx` -- UI for the tab
- `src/hooks/useTranscripts.ts` -- data hook
- Update `src/pages/Index.tsx` -- add 4th tab with Mic icon
- Update `supabase/config.toml` -- register the new edge function

**Audio recording approach:**
- Uses browser `navigator.mediaDevices.getUserMedia()` + `MediaRecorder` API
- Records as webm/opus (natively supported by browsers)
- Uploads the blob to storage, then triggers the edge function

