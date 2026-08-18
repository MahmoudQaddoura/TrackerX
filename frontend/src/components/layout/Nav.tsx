/**
 * layout/Nav.tsx — primary top navigation, scoped per role.
 * Dashboard and assigned projects are available to every signed-in user.
 * Company-wide employee management remains admin/pm-only.
 */
import { CalendarCheck2, CalendarClock, LayoutDashboard, FolderKanban, Users } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

export function Nav() {
  const { canViewManagement, isAdmin } = useAuth();
  const links = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/projects", label: "Projects", icon: FolderKanban },
    { to: "/attendance", label: "Attendance", icon: CalendarCheck2 },
    { to: "/leave-requests", label: isAdmin ? "Leave inbox" : "My leave", icon: CalendarClock },
    ...(canViewManagement ? [{ to: "/employees", label: "Employees", icon: Users }] : []),
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
