/**
 * layout/Nav.tsx — primary top navigation, scoped per role.
 * admin/pm: Dashboard · Projects · Team. developer/client: Projects only
 * (the backend already scopes what "Projects" shows to each of them).
 */
import { LayoutDashboard, FolderKanban, Users } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

export function Nav() {
  const { canManage } = useAuth();
  const links = [
    ...(canManage ? [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] : []),
    { to: "/projects", label: "Projects", icon: FolderKanban },
    ...(canManage ? [{ to: "/team", label: "Team", icon: Users }] : []),
  ];

  return (
    <nav className="flex items-center gap-1">
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-raised hover:text-fg",
            )
          }
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
