import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  return (
    <div className="flex h-screen bg-bg-base overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-full bg-gradient-radial bg-gradient-coral">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
