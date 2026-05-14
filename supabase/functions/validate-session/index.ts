import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface ValidatePayload {
  session_id: string;
  user_id: string;
}

const MIN_PACKETS_FOR_VERIFICATION = 3;
const MIN_KEYSTROKES_PER_PACKET = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { session_id, user_id }: ValidatePayload = await req.json();
    if (!session_id || !user_id) throw new Error("session_id and user_id required");

    // Fetch session analytics
    const { data: analytics } = await supabase
      .from("session_analytics")
      .select("*")
      .eq("session_id", session_id)
      .single();

    const { data: session } = await supabase
      .from("sessions")
      .select("started_at, ended_at, duration_seconds")
      .eq("id", session_id)
      .single();

    const packetCount = analytics?.packet_count ?? 0;
    const totalKeystrokes = analytics?.total_keystrokes ?? 0;
    const durationSeconds = session?.duration_seconds ?? 0;

    // Verification scoring
    let score = 0;
    const details: Record<string, unknown> = {};

    // Has minimum packets
    if (packetCount >= MIN_PACKETS_FOR_VERIFICATION) {
      score += 40;
      details.packets_ok = true;
    } else {
      details.packets_ok = false;
      details.packets_found = packetCount;
      details.packets_required = MIN_PACKETS_FOR_VERIFICATION;
    }

    // Has keystroke activity
    const avgKeystrokesPerPacket = packetCount > 0 ? totalKeystrokes / packetCount : 0;
    if (avgKeystrokesPerPacket >= MIN_KEYSTROKES_PER_PACKET) {
      score += 40;
      details.activity_ok = true;
    } else {
      details.activity_ok = false;
      details.avg_keystrokes = avgKeystrokesPerPacket;
    }

    // Has minimum session duration (5 min)
    if (durationSeconds >= 300) {
      score += 20;
      details.duration_ok = true;
    } else {
      details.duration_ok = false;
      details.duration_seconds = durationSeconds;
    }

    const passed = score >= 60;
    const status = passed ? "passed" : score >= 40 ? "manual_review" : "failed";

    // Update session verification
    await supabase
      .from("sessions")
      .update({ verified: passed })
      .eq("id", session_id);

    // Insert into verification queue
    await supabase.from("verification_queue").insert({
      user_id,
      session_id,
      check_type: "session",
      status,
      score,
      details,
    });

    // Emit event
    await supabase.rpc("emit_workflow_event", {
      p_event_type: "session_verified",
      p_user_id: user_id,
      p_actor_id: null,
      p_entity_id: session_id,
      p_entity_type: "session",
      p_payload: { score, passed, status },
    });

    // Compute earnings if verified (hourly rate * duration)
    if (passed && durationSeconds > 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("hourly_rate, pending_balance, total_earned")
        .eq("id", user_id)
        .single();

      if (profile && profile.hourly_rate > 0) {
        const earned = (durationSeconds / 3600) * profile.hourly_rate;
        const roundedEarned = Math.round(earned * 100) / 100;

        await supabase
          .from("sessions")
          .update({ earnings_accrued: roundedEarned })
          .eq("id", session_id);

        await supabase
          .from("profiles")
          .update({
            pending_balance: profile.pending_balance + roundedEarned,
            total_earned: profile.total_earned + roundedEarned,
          })
          .eq("id", user_id);

        await supabase.from("notifications").insert({
          user_id,
          type: "session",
          title: "Session verified",
          body: `Session verified. $${roundedEarned.toFixed(2)} added to your balance.`,
          metadata: { session_id, earned: roundedEarned },
        });
      }
    }

    return new Response(
      JSON.stringify({ session_id, score, status, passed, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
