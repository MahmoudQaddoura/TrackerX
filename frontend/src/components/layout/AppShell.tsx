/**
 * layout/AppShell.tsx
 * The authenticated frame: sticky header (brand, nav, user, logout) and
 * a centered main area. Every signed-in page renders inside <Outlet/>.
 */
import { LogOut } from "lucide-react";
import { Outlet } from "react-router-dom";

import { BrandLogo } from "@/components/layout/BrandLogo";
import { Nav } from "@/components/layout/Nav";
import { NotificationCenter } from "@/components/layout/NotificationCenter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  pm: "PM",
  developer: "Developer",
  client: "Client",
};

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1360px] items-center gap-4 px-4 sm:px-6">
          <BrandLogo />
          <div className="ml-2 flex-1">
            <Nav />
          </div>
          <div className="flex items-center gap-3">
            {user && user.role !== "client" && <NotificationCenter />}
            {user && (
              <div className="hidden items-center gap-2 sm:flex">
                <Badge variant={user.role === "admin" ? "default" : "neutral"}>
                  {user.is_primary_admin ? "Owner" : ROLE_LABEL[user.role] ?? user.role}
                </Badge>
                <Badge variant={user.role === "admin" || user.access_level === "write" ? "success" : "outline"}>
                  {user.role === "admin" || user.access_level === "write" ? "Read & write" : "Read only"}
                </Badge>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
