/**
 * App.tsx
 * Route table. /login is public; everything else is behind RequireAuth, which
 * renders inside the AppShell. Every signed-in user receives a dashboard that
 * is scoped by the backend to projects they are permitted to see. Employee
 * directory management remains admin/pm-only.
 */
import { Navigate, Route, Routes } from "react-router-dom";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import { DashboardPage } from "@/pages/DashboardPage";
import { AttendanceHubPage } from "@/pages/AttendanceHubPage";
import { ChangePasswordPage } from "@/pages/ChangePasswordPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { EmployeeListPage } from "@/pages/EmployeeListPage";
import { ClientsPage } from "@/pages/ClientsPage";

function RequireManage({ children }: { children: React.ReactNode }) {
  const { canViewManagement } = useAuth();
  if (!canViewManagement) return <Navigate to="/projects" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/attendance" element={<AttendanceHubPage />} />
        <Route path="/leave-requests" element={<Navigate to="/attendance?section=leave" replace />} />
        <Route
          path="/employees"
          element={
            <RequireManage>
              <EmployeeListPage />
            </RequireManage>
          }
        />
        <Route
          path="/clients"
          element={
            <RequireAdmin>
              <ClientsPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
