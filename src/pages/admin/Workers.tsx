import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Progress } from "@/components/ui/Progress";
import { fetchAllWorkers, updateProfile, supabase } from "@/lib/supabase";
import { useRealtime } from "@/hooks/useRealtime";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Profile } from "@/types";

export function Workers() {
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Profile | null>(null);

  useEffect(() => {
    fetchAllWorkers().then(({ data }) => {
      if (data) setWorkers(data);
      setIsLoading(false);
    });
  }, []);

  useRealtime<{ new: Profile; eventType: string }>(
    "workers:all",
    { table: "profiles", event: "UPDATE" },
    (payload) => {
      setWorkers((prev) =>
        prev.map((w) => (w.id === payload.new.id ? payload.new : w))
      );
      if (selected?.id === payload.new.id) setSelected(payload.new);
    }
  );

  const handleToggleWithdrawal = async (worker: Profile) => {
    await updateProfile(worker.id, { withdrawal_enabled: !worker.withdrawal_enabled });
  };

  const handleToggleActive = async (worker: Profile) => {
    await updateProfile(worker.id, { is_active: !worker.is_active });
  };

  const filtered = workers.filter(
    (w) =>
      w.full_name.toLowerCase().includes(search.toLowerCase()) ||
      w.email.toLowerCase().includes(search.toLowerCase())
  );

  const onboarded = workers.filter((w) => w.onboarding_status === "completed").length;
  const withdrawalEnabled = workers.filter((w) => w.withdrawal_enabled).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-sora font-semibold text-2xl text-text-primary">Workers</h1>
          <p className="text-text-muted font-sans text-sm mt-0.5">Manage your distributed workforce</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <p className="text-xs font-grotesk text-text-muted mb-1">Total Workers</p>
          <p className="font-sora font-bold text-2xl text-text-primary">{workers.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-grotesk text-text-muted mb-1">Onboarded</p>
          <p className="font-sora font-bold text-2xl text-lime">{onboarded}</p>
          <Progress value={onboarded} max={Math.max(workers.length, 1)} variant="lime" size="sm" className="mt-2" />
        </Card>
        <Card>
          <p className="text-xs font-grotesk text-text-muted mb-1">Payouts Enabled</p>
          <p className="font-sora font-bold text-2xl text-coral">{withdrawalEnabled}</p>
        </Card>
        <Card>
          <p className="text-xs font-grotesk text-text-muted mb-1">Total Pending</p>
          <p className="font-sora font-bold text-2xl text-text-primary">
            {formatCurrency(workers.reduce((s, w) => s + w.pending_balance, 0))}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Worker list */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-disabled outline-none focus:border-coral/50 font-sans"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Workers</CardTitle>
              <Badge variant="default">{filtered.length}</Badge>
            </CardHeader>
            <div className="space-y-2">
              {filtered.map((worker) => (
                <button
                  key={worker.id}
                  onClick={() => setSelected(worker)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selected?.id === worker.id
                      ? "border-coral/40 bg-coral/5"
                      : "border-border/50 bg-bg-elevated hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar name={worker.full_name || worker.email} size="md" />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg-base ${
                          worker.is_active ? "bg-lime" : "bg-text-disabled"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-sans font-medium text-text-primary truncate">
                        {worker.full_name || "—"}
                      </p>
                      <p className="text-xs text-text-muted font-grotesk truncate">{worker.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={worker.onboarding_status === "completed" ? "success" : "warning"}
                      >
                        {worker.onboarding_status === "completed" ? "Onboarded" : "Training"}
                      </Badge>
                      <span className="text-xs font-grotesk text-coral">
                        {formatCurrency(worker.pending_balance)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-text-disabled font-sans text-sm py-4 text-center">No workers match your search.</p>
              )}
            </div>
          </Card>
        </div>

        {/* Worker detail */}
        <Card>
          <CardHeader>
            <CardTitle>Worker Detail</CardTitle>
          </CardHeader>
          {!selected ? (
            <p className="text-text-disabled font-sans text-sm">Select a worker to view details.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={selected.full_name || selected.email} size="lg" />
                <div>
                  <p className="font-sans font-semibold text-text-primary">{selected.full_name || "—"}</p>
                  <p className="text-xs text-text-muted">{selected.email}</p>
                  <p className="text-xs text-text-disabled font-grotesk mt-0.5">
                    Joined {formatRelativeTime(selected.created_at)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-bg-elevated rounded-lg p-2.5">
                  <p className="text-xs font-grotesk text-text-muted">Balance</p>
                  <p className="font-sora font-bold text-coral">{formatCurrency(selected.pending_balance)}</p>
                </div>
                <div className="bg-bg-elevated rounded-lg p-2.5">
                  <p className="text-xs font-grotesk text-text-muted">Earned</p>
                  <p className="font-sora font-bold text-text-primary">{formatCurrency(selected.total_earned)}</p>
                </div>
                <div className="bg-bg-elevated rounded-lg p-2.5">
                  <p className="text-xs font-grotesk text-text-muted">Rate</p>
                  <p className="font-sora font-bold text-text-primary">${selected.hourly_rate}/hr</p>
                </div>
                <div className="bg-bg-elevated rounded-lg p-2.5">
                  <p className="text-xs font-grotesk text-text-muted">Withdrawn</p>
                  <p className="font-sora font-bold text-lime">{formatCurrency(selected.total_withdrawn)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Badge variant={selected.onboarding_status === "completed" ? "success" : "warning"}>
                  {selected.onboarding_status === "completed" ? "Onboarding complete" : "Onboarding incomplete"}
                </Badge>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <Button
                  variant={selected.withdrawal_enabled ? "secondary" : "lime"}
                  size="sm"
                  className="w-full"
                  onClick={() => handleToggleWithdrawal(selected)}
                >
                  {selected.withdrawal_enabled ? "Disable Payouts" : "Enable Payouts"}
                </Button>
                <Button
                  variant={selected.is_active ? "danger" : "secondary"}
                  size="sm"
                  className="w-full"
                  onClick={() => handleToggleActive(selected)}
                >
                  {selected.is_active ? "Deactivate Account" : "Activate Account"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
