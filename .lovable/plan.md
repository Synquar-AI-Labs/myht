

# Update GPT Model to gpt-5.2

## What will change
A single line update in the `transcribe-audio` backend function to switch the analysis model from `gpt-4o` to `gpt-5.2` (OpenAI's latest model).

## Technical detail
- **File:** `supabase/functions/transcribe-audio/index.ts`, line 96
- **Change:** `model: "gpt-4o"` to `model: "gpt-5.2"`
- The Whisper model (`whisper-1`) stays the same since it's the only transcription model available via OpenAI's API.

