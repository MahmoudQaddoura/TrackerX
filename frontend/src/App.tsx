/**
 * App.tsx
 * Route table. /login is public; everything else is behind RequireAuth, which
 * renders inside the AppShell. Dashboard/Team are admin/pm-only — a
 * developer or client landing there (via the index redirect or a typed URL)
 * bounces to /projects instead.
 */
import { Navigate, Route, Routes } from "react-router-dom";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import { DashboardPage } from "@/pages/DashboardPage";
import { AttendancePage } from "@/pages/AttendancePage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { EmployeeListPage } from "@/pages/EmployeeListPage";

function RequireManage({ children }: { children: React.ReactNode }) {
  const { canViewManagement } = useAuth();
  if (!canViewManagement) return <Navigate to="/projects" replace />;
  return <>{children}</>;
}

function IndexRedirect() {
  const { canViewManagement } = useAuth();
  return <Navigate to={canViewManagement ? "/dashboard" : "/projects"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route index element={<IndexRedirect />} />
        <Route
          path="/dashboard"
          element={
            <RequireManage>
              <DashboardPage />
            </RequireManage>
          }
        />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route
          path="/employees"
          element={
            <RequireManage>
              <EmployeeListPage />
            </RequireManage>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
