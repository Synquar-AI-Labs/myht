// Kept separate so quota responses can be tested without an AI key or request.
export async function claimBeforeTranscription(
  claim: () => PromiseLike<{ error: { message: string } | null }>,
  headers: Record<string, string>,
): Promise<Response | null> {
  try {
    const { error } = await claim();
    if (!error) return null;
    if (error.message === 'transcription_limit_reached') {
      return new Response(JSON.stringify({ error: 'transcription_limit_reached', code: 'transcription_limit_reached' }), {
        status: 429, headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
  } catch { /* authorization and unexpected failures share the same refusal */ }
  return new Response(JSON.stringify({ error: 'Audio is unavailable or you do not have access.' }), {
    status: 403, headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
