import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface ProcessPayload {
  payout_id: string;
  action: "approve" | "release" | "reject";
  actor_id: string;
  notes?: string;
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

    const { payout_id, action, actor_id, notes }: ProcessPayload = await req.json();
    if (!payout_id || !action || !actor_id) {
      throw new Error("payout_id, action, and actor_id required");
    }

    const { data: payout, error: payoutErr } = await supabase
      .from("payouts")
      .select("*")
      .eq("id", payout_id)
      .single();
    if (payoutErr || !payout) throw new Error("Payout not found");

    // Validate transition
    const validTransitions: Record<string, string[]> = {
      pending: ["approve", "reject"],
      approved: ["release", "reject"],
    };
    if (!validTransitions[payout.status]?.includes(action)) {
      throw new Error(`Cannot ${action} a payout in ${payout.status} state`);
    }

    const statusMap: Record<string, string> = {
      approve: "approved",
      release: "released",
      reject: "rejected",
    };
    const newStatus = statusMap[action];
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = {
      status: newStatus,
      reviewed_by: actor_id,
      reviewed_at: now,
      notes: notes ?? null,
    };
    if (action === "release") {
      updates.released_at = now;
    }

    await supabase.from("payouts").update(updates).eq("id", payout_id);

    // On release: deduct from worker's pending_balance, add to withdrawn
    if (action === "release") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("pending_balance, total_withdrawn")
        .eq("id", payout.user_id)
        .single();

      if (profile) {
        await supabase
          .from("profiles")
          .update({
            pending_balance: Math.max(0, profile.pending_balance - payout.amount),
            total_withdrawn: profile.total_withdrawn + payout.amount,
          })
          .eq("id", payout.user_id);
      }
    }

    // Emit workflow event
    const eventMap: Record<string, string> = {
      approve: "payout_approved",
      release: "payout_released",
      reject: "payout_rejected",
    };
    await supabase.rpc("emit_workflow_event", {
      p_event_type: eventMap[action],
      p_user_id: payout.user_id,
      p_actor_id: actor_id,
      p_entity_id: payout_id,
      p_entity_type: "payout",
      p_payload: { amount: payout.amount, action, new_status: newStatus },
    });

    return new Response(
      JSON.stringify({ payout_id, new_status: newStatus, action }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
