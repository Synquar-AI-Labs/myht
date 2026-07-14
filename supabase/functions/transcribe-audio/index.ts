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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is missing");
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse JSON body with storage path
    const { storagePath, fileName } = await req.json();
    if (!storagePath || !fileName) {
      return new Response(JSON.stringify({ error: "storagePath and fileName are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Downloading audio from storage:", { storagePath, fileName });

    // Download file from storage using service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("audio-files")
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error("Storage download error:", downloadError);
      return new Response(JSON.stringify({ error: "Failed to download audio file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Create File for Whisper
    const whisperFile = new File([patchedBytes], safeName, { type: "audio/mp4" });

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const analysisUrl = LOVABLE_API_KEY
      ? "https://ai.gateway.lovable.dev/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
    const analysisKey = LOVABLE_API_KEY || OPENAI_API_KEY;
    const analysisModel = LOVABLE_API_KEY ? "google/gemini-3-flash-preview" : "gpt-5.2";

    const chatRes = await fetch(analysisUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${analysisKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: analysisModel,
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
