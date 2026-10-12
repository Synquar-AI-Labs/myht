import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parsePhotoRequest, PhotoInvalid, RequestTooLarge } from './request.ts';
import { claimBeforePrescription, PRESCRIPTION_REFUSAL } from './claim.ts';
import { photoBase64, prescriptionRequest, readCompletion, reportedTokens, safeErrorType } from './upstream.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version' };
serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  const start = performance.now();
  const metrics: Record<string, unknown> = { photos: 0, sizes: [], medicines: 0 };
  const answer = (status: number, body: unknown) => {
    console.log('prescription_read', { ...metrics, status, elapsed_ms: Math.round(performance.now() - start) });
    return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  };
  const refused = () => answer(403, PRESCRIPTION_REFUSAL);
  const failed = () => answer(502, { error: 'reader_failed', code: 'reader_failed' });
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return answer(401, { error: 'Unauthorized' });
    const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error } = await caller.auth.getUser();
    if (error || !user) return answer(401, { error: 'Unauthorized' });
    const { householdId, photos } = await parsePhotoRequest(request);
    metrics.photos = photos.length; metrics.sizes = photos.map(photo => photo.size);
    const membership = await caller.from('households').select('id').eq('id', householdId).limit(1);
    if (membership.error || !membership.data?.length) return refused();
    const key = Deno.env.get('OPENAI_API_KEY');
    if (!key) return answer(500, { error: 'prescription_not_configured', code: 'prescription_not_configured' });
    const claimFailure = await claimBeforePrescription(() => caller.rpc('claim_prescription_read', { p_household_id: householdId }), cors);
    if (claimFailure) { console.log('prescription_read', { ...metrics, status: claimFailure.status, elapsed_ms: Math.round(performance.now() - start) }); return claimFailure; }
    const encoded: string[] = [];
    for (const photo of photos) encoded.push(photoBase64(new Uint8Array(await photo.arrayBuffer())));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(prescriptionRequest(encoded)), signal: controller.signal });
      metrics.upstream_status = response.status;
      const body: unknown = await response.json();
      Object.assign(metrics, reportedTokens(body));
      if (response.status !== 200) { metrics.error_type = safeErrorType(body); return failed(); }
      const result = readCompletion(body, photos.length);
      metrics.medicines = result.medicines.length;
      return answer(200, result);
    } finally { clearTimeout(timer); }
  } catch (error) {
    if (error instanceof RequestTooLarge) return answer(413, { error: 'photo_too_large', code: 'photo_too_large' });
    if (error instanceof PhotoInvalid) return answer(400, { error: 'photo_invalid', code: 'photo_invalid' });
    // Never log exception messages: JSON errors can contain extracted text.
    return failed();
  }
});
