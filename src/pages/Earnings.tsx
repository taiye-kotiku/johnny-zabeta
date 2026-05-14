import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { useAuthStore } from "@/lib/store";
import { fetchUserPayouts, requestPayout, supabase } from "@/lib/supabase";
import { useRealtime } from "@/hooks/useRealtime";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Payout } from "@/types";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const MIN_PAYOUT = 10;

export function Earnings() {
  const { profile } = useAuthStore();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [earningsHistory, setEarningsHistory] = useState<{ date: string; earned: number }[]>([]);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestError, setRequestError] = useState("");

  useEffect(() => {
    if (!profile) return;
    fetchUserPayouts(profile.id).then(({ data }) => {
      if (data) setPayouts(data);
    });

    // Load 30-day earnings from sessions
    supabase
      .from("sessions")
      .select("started_at, earnings_accrued")
      .eq("user_id", profile.id)
      .eq("verified", true)
      .gte("started_at", new Date(Date.now() - 30 * 86400000).toISOString())
      .order("started_at", { ascending: true })
      .then(({ data }) => {
        if (!data) return;
        // Group by day
        const byDay = data.reduce((acc, s) => {
          const day = s.started_at.split("T")[0];
          acc[day] = (acc[day] ?? 0) + (s.earnings_accrued ?? 0);
          return acc;
        }, {} as Record<string, number>);

        setEarningsHistory(
          Object.entries(byDay).map(([date, earned]) => ({
            date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            earned: Math.round(earned * 100) / 100,
          }))
        );
      });
  }, [profile]);

  // Realtime payout updates
  useRealtime<{ new: Payout }>(
    `payouts:${profile?.id}`,
    {
      table: "payouts",
      filter: profile ? `user_id=eq.${profile.id}` : undefined,
      enabled: !!profile,
    },
    (payload) => {
      setPayouts((prev) => {
        const exists = prev.find((p) => p.id === payload.new.id);
        return exists
          ? prev.map((p) => (p.id === payload.new.id ? payload.new : p))
          : [payload.new, ...prev];
      });
    }
  );

  const handleRequestPayout = async () => {
    if (!profile) return;
    setRequestError("");
    setIsRequesting(true);
    const { error } = await requestPayout(profile.id, profile.pending_balance);
    if (error) {
      setRequestError(error.message);
    } else {
      const { data } = await fetchUserPayouts(profile.id);
      if (data) setPayouts(data);
    }
    setIsRequesting(false);
  };

  const totalReleased = payouts.filter((p) => p.status === "released").reduce((s, p) => s + p.amount, 0);
  const pendingPayoutAmount = payouts.filter((p) => p.status === "pending" || p.status === "approved").reduce((s, p) => s + p.amount, 0);
  const pendingBalance = profile?.pending_balance ?? 0;
  const canRequest = profile?.withdrawal_enabled && pendingBalance >= MIN_PAYOUT && pendingPayoutAmount === 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-sora font-semibold text-2xl text-text-primary">Earnings</h1>
        <p className="text-text-muted font-sans text-sm mt-0.5">Your wallet and payout history</p>
      </div>

      {/* Wallet cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card glow="coral">
          <p className="text-xs font-grotesk text-text-muted mb-2">Available Balance</p>
          <p className="font-sora font-bold text-3xl text-coral">
            {formatCurrency(pendingBalance)}
          </p>
          <p className="text-xs text-text-disabled font-sans mt-2">
            {profile?.withdrawal_enabled ? "Withdrawals enabled" : "Awaiting admin approval"}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-grotesk text-text-muted mb-2">Total Earned</p>
          <p className="font-sora font-bold text-3xl text-text-primary">
            {formatCurrency(profile?.total_earned ?? 0)}
          </p>
          <p className="text-xs text-text-disabled font-sans mt-2">all time</p>
        </Card>
        <Card>
          <p className="text-xs font-grotesk text-text-muted mb-2">Total Withdrawn</p>
          <p className="font-sora font-bold text-3xl text-lime">
            {formatCurrency(profile?.total_withdrawn ?? 0)}
          </p>
          <p className="text-xs text-text-disabled font-sans mt-2">lifetime withdrawals</p>
        </Card>
      </div>

      {/* Withdraw action */}
      <Card>
        <CardHeader>
          <CardTitle>Request Payout</CardTitle>
          {!profile?.withdrawal_enabled && <Badge variant="warning">Not yet enabled</Badge>}
        </CardHeader>
        <div className="space-y-4">
          {!profile?.withdrawal_enabled ? (
            <p className="text-text-muted font-sans text-sm">
              Payouts are enabled by your administrator once your account is verified. Complete your onboarding and accumulate a balance to get started.
            </p>
          ) : (
            <>
              <div>
                <div className="flex justify-between text-xs font-grotesk text-text-muted mb-1">
                  <span>Balance toward minimum</span>
                  <span>{formatCurrency(pendingBalance)} / {formatCurrency(MIN_PAYOUT)}</span>
                </div>
                <Progress value={pendingBalance} max={MIN_PAYOUT} variant="coral" size="md" />
              </div>
              {pendingPayoutAmount > 0 && (
                <p className="text-xs text-yellow-400 font-sans">
                  You have a payout of {formatCurrency(pendingPayoutAmount)} currently in review.
                </p>
              )}
              {requestError && (
                <p className="text-xs text-red-400 font-sans">{requestError}</p>
              )}
              <Button
                variant="primary"
                size="lg"
                disabled={!canRequest}
                isLoading={isRequesting}
                onClick={handleRequestPayout}
              >
                Request {formatCurrency(pendingBalance)}
              </Button>
              <p className="text-xs text-text-disabled font-sans">
                Payouts are reviewed within 1–3 business days.
              </p>
            </>
          )}
        </div>
      </Card>

      {/* Earnings chart */}
      {earningsHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Earnings (Last 30 Days)</CardTitle>
          </CardHeader>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={earningsHistory} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF4D6D" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF4D6D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#A1A1AA", fontSize: 10, fontFamily: "Space Grotesk" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#A1A1AA", fontSize: 10, fontFamily: "Space Grotesk" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#171923",
                    border: "1px solid #2A2D3E",
                    borderRadius: 8,
                    fontSize: 12,
                    fontFamily: "DM Sans",
                    color: "#F8FAFC",
                  }}
                  formatter={(v: number) => [formatCurrency(v), "Earned"]}
                />
                <Area type="monotone" dataKey="earned" stroke="#FF4D6D" strokeWidth={2} fill="url(#earnGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Payout history */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <span className="text-xs font-grotesk text-text-muted">{formatCurrency(totalReleased)} released</span>
        </CardHeader>
        {payouts.length === 0 ? (
          <p className="text-text-disabled font-sans text-sm">No payout requests yet.</p>
        ) : (
          <div className="space-y-2">
            {payouts.map((payout) => (
              <div key={payout.id} className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg border border-border/50">
                <div>
                  <p className="font-sora font-semibold text-text-primary">{formatCurrency(payout.amount)}</p>
                  <p className="text-xs text-text-disabled font-grotesk mt-0.5">
                    Requested {formatRelativeTime(payout.requested_at)}
                    {payout.released_at && ` · Released ${formatRelativeTime(payout.released_at)}`}
                  </p>
                </div>
                <PayoutBadge status={payout.status} />
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
