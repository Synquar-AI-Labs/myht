

## Upgrade ChatGPT Model to gpt-5.2

**What changes:** Update the model used for transcript analysis in the `transcribe-audio` backend function from `gpt-4o-mini` to `gpt-5.2`.

### Technical Details

**File:** `supabase/functions/transcribe-audio/index.ts`  
- Line 96: Change `"gpt-4o-mini"` to `"gpt-5.2"`

This is a single-line change. The Whisper model (`whisper-1`) for audio transcription remains unchanged. After editing, the function will be redeployed automatically.

