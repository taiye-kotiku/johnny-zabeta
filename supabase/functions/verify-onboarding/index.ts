import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface VerifyPayload {
  user_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { user_id }: VerifyPayload = await req.json();
    if (!user_id) throw new Error("user_id required");

    // Fetch training slides total
    const { data: slides, error: slidesErr } = await supabase
      .from("training_slides")
      .select("id")
      .eq("is_active", true);
    if (slidesErr) throw slidesErr;

    // Fetch user training progress
    const { data: progress, error: progressErr } = await supabase
      .from("training_progress")
      .select("slide_id")
      .eq("user_id", user_id);
    if (progressErr) throw progressErr;

    const totalSlides = slides?.length ?? 0;
    const completedSlides = progress?.length ?? 0;
    const isComplete = totalSlides > 0 && completedSlides >= totalSlides;

    if (isComplete) {
      // Mark onboarding complete
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          onboarding_status: "completed",
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", user_id);
      if (profileErr) throw profileErr;

      // Emit workflow event
      await supabase.rpc("emit_workflow_event", {
        p_event_type: "onboarding_completed",
        p_user_id: user_id,
        p_actor_id: user_id,
        p_entity_id: user_id,
        p_entity_type: "profile",
        p_payload: { slides_completed: completedSlides },
      });

      // Add to verification queue as passed
      await supabase.from("verification_queue").insert({
        user_id,
        check_type: "onboarding",
        status: "passed",
        score: 100,
        details: { slides_total: totalSlides, slides_completed: completedSlides },
      });

      // Send notification
      await supabase.from("notifications").insert({
        user_id,
        type: "success",
        title: "Training complete",
        body: "You have completed onboarding. You can now start your first session.",
      });
    }

    return new Response(
      JSON.stringify({
        verified: isComplete,
        slides_total: totalSlides,
        slides_completed: completedSlides,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
