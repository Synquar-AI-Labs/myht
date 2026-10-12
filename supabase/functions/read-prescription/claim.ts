export const PRESCRIPTION_REFUSAL = { error: 'Reading is unavailable or you do not have access.' };
export async function claimBeforePrescription(claim: () => PromiseLike<{ error: { message: string } | null }>, headers: Record<string, string>) {
  try {
    const { error } = await claim();
    if (!error) return null;
    if (error.message === 'prescription_limit_reached') return new Response(JSON.stringify({ error: 'prescription_limit_reached', code: 'prescription_limit_reached' }), { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch { /* Same refusal for access and unexpected errors. */ }
  return new Response(JSON.stringify(PRESCRIPTION_REFUSAL), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
}
