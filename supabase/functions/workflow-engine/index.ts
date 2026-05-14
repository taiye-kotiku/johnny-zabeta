import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Workflow Engine — evaluates active rules against incoming events.
 * Called via database webhook or scheduled job when workflow_events are inserted.
 */

interface EnginePayload {
  event_type: string;
  user_id: string;
  entity_id?: string;
  entity_type?: string;
  payload?: Record<string, unknown>;
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

    const event: EnginePayload = await req.json();
    const { event_type, user_id, payload = {} } = event;

    // Fetch active rules matching this trigger
    const triggerMap: Record<string, string> = {
      onboarding_completed: "onboarding_completed",
      session_ended: "session_duration_threshold",
      task_approved: "task_approved",
      payout_requested: "payout_requested",
      activity_packet_received: "activity_packet_count",
    };

    const ruleTrigger = triggerMap[event_type];
    if (!ruleTrigger) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no rule trigger for event" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: rules } = await supabase
      .from("workflow_rules")
      .select("*")
      .eq("trigger", ruleTrigger)
      .eq("is_active", true);

    const executed: string[] = [];

    for (const rule of rules ?? []) {
      const actionConfig = rule.action_config as Record<string, unknown>;
      const triggerConfig = rule.trigger_config as Record<string, unknown>;

      // Check threshold conditions
      if (ruleTrigger === "session_duration_threshold") {
        const threshold = (triggerConfig.threshold_seconds as number) ?? 28800;
        const duration = (payload.duration_seconds as number) ?? 0;
        if (duration < threshold) continue;
      }

      if (ruleTrigger === "activity_packet_count") {
        const threshold = (triggerConfig.packet_threshold as number) ?? 10;
        const count = (payload.packet_count as number) ?? 0;
        if (count < threshold) continue;
      }

      // Execute action
      switch (rule.action) {
        case "send_notification":
          await supabase.from("notifications").insert({
            user_id,
            type: "info",
            title: actionConfig.title as string,
            body: actionConfig.body as string,
            metadata: { rule_id: rule.id, event_type },
          });
          break;

        case "enable_withdrawal":
          await supabase
            .from("profiles")
            .update({ withdrawal_enabled: true })
            .eq("id", user_id);
          break;

        case "disable_withdrawal":
          await supabase
            .from("profiles")
            .update({ withdrawal_enabled: false })
            .eq("id", user_id);
          break;

        case "emit_event":
          await supabase.rpc("emit_workflow_event", {
            p_event_type: actionConfig.event_type as string,
            p_user_id: user_id,
            p_actor_id: null,
            p_entity_id: null,
            p_entity_type: "rule",
            p_payload: { rule_id: rule.id, triggered_by: event_type },
          });
          break;
      }

      executed.push(rule.id);
    }

    return new Response(
      JSON.stringify({ event_type, rules_evaluated: rules?.length ?? 0, rules_executed: executed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
