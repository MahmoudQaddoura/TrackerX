/**
 * layout/RequireAuth.tsx
 * Route guard: waits for the session to resolve, redirects to /login when there
 * is no user, and otherwise renders the AppShell (which hosts the page Outlet).
 */
import { Navigate, useLocation } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { FullPageSpinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/AuthContext";

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (user.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <AppShell />;
}
