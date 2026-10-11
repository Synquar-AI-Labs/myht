import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const refused = () => new Response(JSON.stringify({ error: "Audio is unavailable or you do not have access." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    let body;
    try { body = await req.json(); } catch { return refused(); }
    const storagePath = body?.storagePath;
    // Exactly household/date/timestamp.extension; no traversal or alternate paths.
    if (typeof storagePath !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/\d{4}-\d{2}-\d{2}\/\d+\.(m4a|mp4|mp3|mpeg|mpga|wav|webm|ogg|oga|flac)$/i.test(storagePath)) return refused();
    const fileName = storagePath.split('/').pop()!;
    // The caller's Storage RLS is the authorization boundary, before AI config.
    let fileData: Blob;
    try {
      const { data, error } = await supabaseUser.storage.from("audio-files").download(storagePath);
      if (error || !data) return refused();
      fileData = data;
    } catch { return refused(); }
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const audioBytes = new Uint8Array(await fileData.arrayBuffer());
    console.log("Downloaded file:", { size: audioBytes.length, type: fileData.type });

    // OpenAI's transcription endpoint rejects files over 25 MB — fail with a
    // human explanation instead of a cryptic upstream 413.
    const MAX_TRANSCRIBABLE_BYTES = 25 * 1024 * 1024;
    if (audioBytes.length > MAX_TRANSCRIBABLE_BYTES) {
      const mb = (audioBytes.length / (1024 * 1024)).toFixed(1);
      return new Response(
        JSON.stringify({ error: `This recording is ${mb} MB — the transcription limit is 25 MB (about 90 minutes of speech). Please split longer conversations.` }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check magic bytes to detect 3GP container (Apple Voice Memos)
    // MP4/M4A/3GP files have "ftyp" at offset 4
    const magicStr = new TextDecoder("ascii").decode(audioBytes.slice(4, 8));
    const ftypBrand = new TextDecoder("ascii").decode(audioBytes.slice(8, 12));
    console.log("File format:", { magic: magicStr, brand: ftypBrand });

    // If 3GP container, patch the ftyp major brand to "isom" (ISO Base Media)
    // so Whisper recognizes it as a valid MP4/M4A container.
    // 3GP and MP4 share the same ISO base media file format — the audio codec
    // (AAC) inside is identical, only the brand label differs.
    let patchedBytes = audioBytes;
    if (magicStr === "ftyp" && (ftypBrand === "3gp4" || ftypBrand === "3gp5" || ftypBrand === "3gp6" || ftypBrand.startsWith("3gp"))) {
      console.log("Detected 3GP container — patching ftyp brand to 'M4A ' for Whisper compatibility");
      patchedBytes = new Uint8Array(audioBytes);
      // Write "M4A " at offset 8 (major brand)
      const brandBytes = new TextEncoder().encode("M4A ");
      patchedBytes.set(brandBytes, 8);
    }

    // Determine safe filename with correct extension
    const ext = fileName.split(".").pop()?.toLowerCase() || "m4a";
    const safeName = `recording_${Date.now()}.${ext}`;

    // Label the File with its ACTUAL content type — sending webm/wav as
    // "audio/mp4" can confuse the transcription service.
    const CONTENT_TYPES: Record<string, string> = {
      m4a: "audio/mp4", mp4: "audio/mp4", mp3: "audio/mpeg", mpeg: "audio/mpeg",
      mpga: "audio/mpeg", wav: "audio/wav", webm: "audio/webm", ogg: "audio/ogg",
      oga: "audio/ogg", flac: "audio/flac",
    };
    const whisperFile = new File([patchedBytes], safeName, {
      type: CONTENT_TYPES[ext] ?? "audio/mp4",
    });

    console.log("Sending to Whisper:", { safeName, size: patchedBytes.length, patched: patchedBytes !== audioBytes });

    // Step 1: Transcribe with Whisper
    const whisperForm = new FormData();
    whisperForm.append("file", whisperFile);
    whisperForm.append("model", "whisper-1");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.text();
      console.error("Whisper error:", whisperRes.status, err);
      const friendly = whisperRes.status === 413
        ? "The recording is too large for the transcription service (25 MB limit)."
        : whisperRes.status === 429
          ? "The transcription service is busy right now — please try again in a minute."
          : `Transcription failed (service error ${whisperRes.status}). Please try again.`;
      return new Response(JSON.stringify({ error: friendly, details: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text: transcript } = await whisperRes.json();
    console.log("Transcription successful, length:", transcript.length);

    // Step 2: Analyze with ChatGPT
    const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: `You are a medical conversation analyst. Given a transcript of a doctor-patient conversation, produce a JSON object with exactly these fields:
- "summary": a concise executive summary of the conversation (2-4 sentences)
- "action_items": an array of strings listing things the patient needs to do
- "follow_ups": an array of strings listing things to follow up on later
Respond ONLY with valid JSON, no markdown.`,
          },
          { role: "user", content: transcript },
        ],
        temperature: 0.3,
      }),
    });

    if (!chatRes.ok) {
      const err = await chatRes.text();
      console.error("Analysis error:", chatRes.status, err);
      // Still return the transcript even if analysis fails
      return new Response(
        JSON.stringify({
          transcript,
          summary: "Analysis unavailable",
          action_items: [],
          follow_ups: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chatData = await chatRes.json();
    const rawContent = chatData.choices[0].message.content;

    let analysis;
    try {
      let jsonStr = rawContent.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      analysis = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse analysis response:", rawContent);
      analysis = { summary: rawContent, action_items: [], follow_ups: [] };
    }

    return new Response(
      JSON.stringify({
        transcript,
        summary: analysis.summary || "",
        action_items: analysis.action_items || [],
        follow_ups: analysis.follow_ups || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("transcribe-audio error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
