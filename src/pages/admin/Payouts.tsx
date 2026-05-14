import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuthStore } from "@/lib/store";
import { fetchAllPayouts, supabase } from "@/lib/supabase";
import { useRealtime } from "@/hooks/useRealtime";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Payout } from "@/types";

type PayoutFilter = "all" | "pending" | "approved" | "released" | "rejected";

export function Payouts() {
  const { profile } = useAuthStore();
  const [payouts, setPayouts] = useState<(Payout & { profiles?: { full_name: string; email: string } })[]>([]);
  const [filter, setFilter] = useState<PayoutFilter>("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const reload = async () => {
    const { data } = await fetchAllPayouts();
    if (data) setPayouts(data as typeof payouts);
  };

  useEffect(() => {
    reload().then(() => setIsLoading(false));
  }, []);

  useRealtime<{ new: Payout }>(
    "payouts:admin",
    { table: "payouts", event: "*" },
    () => { reload(); }
  );

  const handleAction = async (
    payoutId: string,
    action: "approve" | "release" | "reject"
  ) => {
    if (!profile) return;
    setProcessing(payoutId);

    const statusMap = { approve: "approved", release: "released", reject: "rejected" };
    await supabase
      .from("payouts")
      .update({
        status: statusMap[action],
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        released_at: action === "release" ? new Date().toISOString() : null,
      })
      .eq("id", payoutId);

    if (action === "release") {
      const payout = payouts.find((p) => p.id === payoutId);
      if (payout) {
        const { data: p } = await supabase
          .from("profiles")
          .select("pending_balance, total_withdrawn")
          .eq("id", payout.user_id)
          .single();
        if (p) {
          await supabase
            .from("profiles")
            .update({
              pending_balance: Math.max(0, p.pending_balance - payout.amount),
              total_withdrawn: p.total_withdrawn + payout.amount,
            })
            .eq("id", payout.user_id);
        }
      }
    }

    await reload();
    setProcessing(null);
  };

  const filtered = filter === "all" ? payouts : payouts.filter((p) => p.status === filter);
  const pendingTotal = payouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const releasedTotal = payouts.filter((p) => p.status === "released").reduce((s, p) => s + p.amount, 0);

  const filters: { id: PayoutFilter; label: string }[] = [
    { id: "pending", label: `Pending (${payouts.filter((p) => p.status === "pending").length})` },
    { id: "approved", label: "Approved" },
    { id: "released", label: "Released" },
    { id: "rejected", label: "Rejected" },
    { id: "all", label: "All" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-sora font-semibold text-2xl text-text-primary">Payouts</h1>
        <p className="text-text-muted font-sans text-sm mt-0.5">Review and process worker payout requests</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <p className="text-xs font-grotesk text-text-muted mb-1">Pending Review</p>
          <p className="font-sora font-bold text-2xl text-yellow-400">
            {formatCurrency(pendingTotal)}
          </p>
          <p className="text-xs text-text-disabled font-sans mt-1">
            {payouts.filter((p) => p.status === "pending").length} requests
          </p>
        </Card>
        <Card>
          <p className="text-xs font-grotesk text-text-muted mb-1">Total Released</p>
          <p className="font-sora font-bold text-2xl text-lime">{formatCurrency(releasedTotal)}</p>
        </Card>
        <Card>
          <p className="text-xs font-grotesk text-text-muted mb-1">Total Requests</p>
          <p className="font-sora font-bold text-2xl text-text-primary">{payouts.length}</p>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-bg-surface border border-border rounded-xl p-1 w-fit">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-sans transition-all ${
              filter === f.id
                ? "bg-coral text-white font-medium"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <p className="text-text-disabled font-sans text-sm py-4 text-center">No payouts in this category.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((payout) => (
              <div
                key={payout.id}
                className="flex items-center justify-between p-4 bg-bg-elevated rounded-xl border border-border/50"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-sora font-bold text-text-primary text-lg">
                      {formatCurrency(payout.amount)}
                    </p>
                    <PayoutBadge status={payout.status} />
                  </div>
                  <p className="text-xs font-grotesk text-text-muted">
                    {payout.profiles?.full_name || payout.profiles?.email || payout.user_id}
                  </p>
                  <p className="text-xs font-grotesk text-text-disabled">
                    Requested {formatRelativeTime(payout.requested_at)}
                    {payout.released_at && ` · Released ${formatRelativeTime(payout.released_at)}`}
                  </p>
                  {payout.notes && (
                    <p className="text-xs font-sans text-text-muted italic">{payout.notes}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {payout.status === "pending" && (
                    <>
                      <Button
                        variant="lime"
                        size="sm"
                        isLoading={processing === payout.id}
                        onClick={() => handleAction(payout.id, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        isLoading={processing === payout.id}
                        onClick={() => handleAction(payout.id, "reject")}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {payout.status === "approved" && (
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={processing === payout.id}
                      onClick={() => handleAction(payout.id, "release")}
                    >
                      Release
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PayoutBadge({ status }: { status: Payout["status"] }) {
  const map: Record<Payout["status"], { label: string; variant: "default" | "success" | "warning" | "coral" | "lime" | "danger" | "lavender" }> = {
    pending: { label: "Pending", variant: "warning" },
    approved: { label: "Approved", variant: "lavender" },
    released: { label: "Released", variant: "success" },
    rejected: { label: "Rejected", variant: "danger" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}
