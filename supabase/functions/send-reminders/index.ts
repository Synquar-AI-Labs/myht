import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use service role for data access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get reminder settings
    const { data: settings, error: settingsError } = await supabase
      .from("reminder_settings")
      .select("*")
      .limit(1)
      .single();

    if (settingsError || !settings || settings.emails.length === 0) {
      return new Response(
        JSON.stringify({ message: "No reminder settings or emails configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const results: string[] = [];

    // --- 1. Daily update reminder ---
    const { data: todayRecord } = await supabase
      .from("health_records")
      .select("id")
      .eq("date", today)
      .limit(1);

    if (!todayRecord || todayRecord.length === 0) {
      const emailRes = await resend.emails.send({
        from: "Health Tracker <reminders@support.synquarailabs.com>",
        to: settings.emails,
        subject: "⚠️ Daily Health Update Missing",
        html: `
          <h2>Daily Health Update Reminder</h2>
          <p>No health record has been logged for <strong>${today}</strong>.</p>
          <p>Please update Dad's daily health record as soon as possible.</p>
          <p style="color:#888;font-size:12px;">— Dad's Health Tracker</p>
        `,
      });
      results.push(`Daily reminder sent: ${JSON.stringify(emailRes)}`);
    } else {
      results.push("Daily record exists, no reminder needed.");
    }

    // --- 2. Appointment reminders (1 day before) ---
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const { data: upcomingAppts } = await supabase
      .from("appointments")
      .select("*")
      .eq("date", tomorrowStr);

    if (upcomingAppts && upcomingAppts.length > 0) {
      for (const appt of upcomingAppts) {
        const emailRes = await resend.emails.send({
          from: "Health Tracker <reminders@support.synquarailabs.com>",
          to: settings.emails,
          subject: `📅 Appointment Tomorrow: ${appt.doctor_name}`,
          html: `
            <h2>Appointment Reminder</h2>
            <p>There is an appointment scheduled for <strong>${appt.date}</strong> at <strong>${appt.time}</strong>.</p>
            <ul>
              <li><strong>Doctor:</strong> ${appt.doctor_name}</li>
              <li><strong>Reason:</strong> ${appt.reason}</li>
              ${appt.address ? `<li><strong>Address:</strong> ${appt.address}</li>` : ""}
              ${appt.description ? `<li><strong>Notes:</strong> ${appt.description}</li>` : ""}
            </ul>
            <p style="color:#888;font-size:12px;">— Dad's Health Tracker</p>
          `,
        });
        results.push(`Appointment reminder sent for ${appt.doctor_name}: ${JSON.stringify(emailRes)}`);
      }
    } else {
      results.push("No appointments tomorrow.");
    }

    console.log("Reminder results:", results);

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-reminders:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
