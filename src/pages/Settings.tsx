import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useAuthStore, useSessionStore } from "@/lib/store";
import { updateProfile, signOut } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

export function Settings() {
  const { profile, setProfile } = useAuthStore();
  const { screenshotsEnabled, setScreenshotsEnabled } = useSessionStore();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setIsSaving(true);
    const { data } = await updateProfile(profile.id, { full_name: fullName });
    if (data) {
      setProfile(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setIsSaving(false);
  };

  if (!profile) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-sora font-semibold text-2xl text-text-primary">Settings</h1>
        <p className="text-text-muted font-sans text-sm mt-0.5">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <Badge variant={profile.role === "admin" ? "lavender" : "default"}>
            {profile.role}
          </Badge>
        </CardHeader>
        <div className="flex items-center gap-4 mb-5">
          <Avatar name={profile.full_name || profile.email} size="lg" />
          <div>
            <p className="font-sans font-medium text-text-primary">{profile.full_name || "—"}</p>
            <p className="text-sm text-text-muted">{profile.email}</p>
          </div>
        </div>
        <div className="space-y-4">
          <Input
            id="fullName"
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
          />
          <Button
            variant="primary"
            size="md"
            isLoading={isSaving}
            onClick={handleSaveProfile}
          >
            {saved ? "Saved!" : "Save Changes"}
          </Button>
        </div>
      </Card>

      {/* Wallet info */}
      <Card>
        <CardHeader>
          <CardTitle>Wallet</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-bg-elevated rounded-lg p-3">
            <p className="text-xs font-grotesk text-text-muted">Pending</p>
            <p className="font-sora font-bold text-lg text-coral mt-1">
              {formatCurrency(profile.pending_balance)}
            </p>
          </div>
          <div className="bg-bg-elevated rounded-lg p-3">
            <p className="text-xs font-grotesk text-text-muted">Total Earned</p>
            <p className="font-sora font-bold text-lg text-text-primary mt-1">
              {formatCurrency(profile.total_earned)}
            </p>
          </div>
          <div className="bg-bg-elevated rounded-lg p-3">
            <p className="text-xs font-grotesk text-text-muted">Withdrawn</p>
            <p className="font-sora font-bold text-lg text-lime mt-1">
              {formatCurrency(profile.total_withdrawn)}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${profile.withdrawal_enabled ? "bg-lime" : "bg-yellow-400"}`} />
          <p className="text-xs font-sans text-text-muted">
            {profile.withdrawal_enabled
              ? "Withdrawals are enabled on your account."
              : "Withdrawal access is pending admin approval."}
          </p>
        </div>
      </Card>

      {/* Privacy & Tracking */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy & Activity Tracking</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <div className="p-3 bg-bg-elevated rounded-lg border border-border/50">
            <p className="text-sm font-sans font-medium text-text-primary">Keystroke frequency</p>
            <p className="text-xs text-text-muted font-sans mt-1">
              Counts keystrokes per 60-second window to verify active work. Key content is never recorded or transmitted.
            </p>
            <Badge variant="success" className="mt-2">Always on during session</Badge>
          </div>

          <div className="p-3 bg-bg-elevated rounded-lg border border-border/50">
            <p className="text-sm font-sans font-medium text-text-primary">Mouse activity</p>
            <p className="text-xs text-text-muted font-sans mt-1">
              Counts mouse move events per 60-second window. Position data is not stored.
            </p>
            <Badge variant="success" className="mt-2">Always on during session</Badge>
          </div>

          <div className="p-3 bg-bg-elevated rounded-lg border border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-sans font-medium text-text-primary">Activity snapshots</p>
                <p className="text-xs text-text-muted font-sans mt-1">
                  Optional low-resolution screenshots uploaded every 5 minutes. You control this setting.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={screenshotsEnabled}
                  onChange={(e) => setScreenshotsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-bg-base peer-focus:ring-2 peer-focus:ring-coral/30 rounded-full peer peer-checked:bg-coral after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
            <Badge variant={screenshotsEnabled ? "coral" : "default"} className="mt-2">
              {screenshotsEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-grotesk text-text-muted mb-1">Onboarding status</p>
            <Badge variant={profile.onboarding_status === "completed" ? "success" : "warning"}>
              {profile.onboarding_status === "completed" ? "Complete" : "Incomplete"}
            </Badge>
          </div>
          <div>
            <p className="text-xs font-grotesk text-text-muted mb-1">Member since</p>
            <p className="text-sm font-sans text-text-muted">
              {new Date(profile.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="pt-3 border-t border-border">
            <Button variant="danger" size="md" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
