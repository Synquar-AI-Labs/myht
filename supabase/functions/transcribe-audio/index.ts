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
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
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

    // Accept JSON body with audioUrl
    const contentType = req.headers.get("content-type") || "";
    let audioBlob: Blob;

    if (contentType.includes("application/json")) {
      // New approach: receive storage URL, fetch audio server-side
      const { audioUrl } = await req.json();
      if (!audioUrl) {
        return new Response(JSON.stringify({ error: "No audioUrl provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Fetching audio from URL:", audioUrl);
      const audioRes = await fetch(audioUrl);
      if (!audioRes.ok) {
        console.error("Failed to fetch audio:", audioRes.status);
        return new Response(JSON.stringify({ error: "Failed to fetch audio from storage" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const audioBuffer = await audioRes.arrayBuffer();
      audioBlob = new Blob([audioBuffer]);
    } else if (contentType.includes("multipart/form-data")) {
      // Legacy: direct file upload
      const formData = await req.formData();
      const file = formData.get("audio") as File;
      if (!file) {
        return new Response(JSON.stringify({ error: "No audio file provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      audioBlob = file;
    } else {
      return new Response(JSON.stringify({ error: "Unsupported content type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Transcribe with Whisper
    const whisperForm = new FormData();
    whisperForm.append("file", new File([audioBlob], "recording.webm", { type: "audio/webm" }));
    whisperForm.append("model", "whisper-1");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.text();
      console.error("Whisper error:", whisperRes.status, err);
      return new Response(JSON.stringify({ error: "Transcription failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text: transcript } = await whisperRes.json();

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
      console.error("ChatGPT error:", chatRes.status, err);
      return new Response(JSON.stringify({ error: "Analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatData = await chatRes.json();
    const rawContent = chatData.choices[0].message.content;

    let analysis;
    try {
      analysis = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse ChatGPT response:", rawContent);
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
