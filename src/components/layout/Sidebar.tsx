import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { useNotifications } from "@/hooks/useNotifications";
import { Avatar } from "@/components/ui/Avatar";
import { signOut } from "@/lib/supabase";

interface NavItem {
  label: string;
  to: string;
  icon: (p: { className?: string }) => JSX.Element;
  end?: boolean;
}

const workerNav: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: GridIcon, end: true },
  { label: "Sessions", to: "/sessions", icon: ActivityIcon },
  { label: "Tasks", to: "/tasks", icon: CheckSquareIcon },
  { label: "Earnings", to: "/earnings", icon: WalletIcon },
  { label: "Settings", to: "/settings", icon: SettingsIcon },
];

const adminNav: NavItem[] = [
  { label: "Overview", to: "/admin", icon: GridIcon, end: true },
  { label: "Workers", to: "/admin/workers", icon: UsersIcon },
  { label: "Tasks", to: "/admin/tasks", icon: CheckSquareIcon },
  { label: "Payouts", to: "/admin/payouts", icon: WalletIcon },
  { label: "Analytics", to: "/admin/analytics", icon: BarChartIcon },
];

export function Sidebar() {
  const { profile } = useAuthStore();
  const { unreadCount, notifications, markRead } = useNotifications();
  const isAdmin = profile?.role === "admin";
  const nav = isAdmin ? adminNav : workerNav;

  return (
    <aside className="w-56 h-screen bg-bg-surface border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-border flex items-center justify-between">
        <span className="font-sora font-bold text-xl text-text-primary tracking-tight">
          zab<span className="text-coral">eta</span>
        </span>
        {isAdmin && (
          <span className="text-xs font-grotesk text-lavender bg-lavender/10 px-1.5 py-0.5 rounded">
            admin
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ label, to, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-sans transition-all duration-150",
                isActive
                  ? "bg-coral/10 text-coral font-medium"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-elevated"
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Notifications tray */}
      {unreadCount > 0 && (
        <div className="mx-3 mb-2 p-3 bg-bg-elevated rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-grotesk text-text-muted">Notifications</span>
            <span className="text-xs font-grotesk text-coral font-semibold">{unreadCount} new</span>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {notifications.filter((n) => !n.is_read).slice(0, 3).map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className="w-full text-left"
              >
                <p className="text-xs font-sans text-text-primary leading-snug">{n.title}</p>
                {n.body && (
                  <p className="text-xs text-text-disabled font-sans leading-snug line-clamp-1 mt-0.5">{n.body}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* User */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <Avatar name={profile?.full_name || profile?.email || "?"} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-sans font-medium text-text-primary truncate">
              {profile?.full_name || "User"}
            </p>
            <p className="text-xs font-grotesk text-text-disabled truncate">
              {profile?.email}
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="text-text-disabled hover:text-text-muted transition-colors shrink-0"
            title="Sign out"
          >
            <LogOutIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function CheckSquareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
