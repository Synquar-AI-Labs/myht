export function transcriptionError(body: { code?: string; error?: string }, fallback: string): string {
  if (body.code === 'transcription_not_configured') return 'Transcription is not set up on this server yet. Your audio is safe.';
  if (body.code === 'transcription_limit_reached') return "Today's transcription limit for this family has been reached. Your audio is safe. Try again tomorrow.";
  return body.error || fallback;
}
