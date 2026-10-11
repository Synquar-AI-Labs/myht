export async function requireFunctionRuntime(api) {
  if (api !== 'http://127.0.0.1:54321') throw new Error('REFUSED: API must be http://127.0.0.1:54321');
  try {
    const response = await fetch(api + '/functions/v1/transcribe-audio', {
      method: 'POST', signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401) return;
  } catch { /* report the same actionable message for an unavailable runtime */ }
  console.error('Local function runtime unavailable. Start: npx --yes supabase@2.120.0 functions serve transcribe-audio --env-file <path-to-empty-key-env> (see e2e/README.md).');
  process.exit(1);
}
