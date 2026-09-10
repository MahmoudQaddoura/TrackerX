/**
 * App.tsx
 * Route table. /login is public; everything else is behind RequireAuth, which
 * renders inside the AppShell. Every signed-in user receives a dashboard that
 * is scoped by the backend to projects they are permitted to see. Employee
 * directory management remains admin/pm-only.
 */
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { FullPageSpinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/AuthContext";

const AttendanceHubPage = lazy(() =>
  import("@/pages/AttendanceHubPage").then((module) => ({ default: module.AttendanceHubPage })),
);
const ChangePasswordPage = lazy(() =>
  import("@/pages/ChangePasswordPage").then((module) => ({ default: module.ChangePasswordPage })),
);
const ClientsPage = lazy(() =>
  import("@/pages/ClientsPage").then((module) => ({ default: module.ClientsPage })),
);
const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((module) => ({ default: module.DashboardPage })),
);
const EmployeeListPage = lazy(() =>
  import("@/pages/EmployeeListPage").then((module) => ({ default: module.EmployeeListPage })),
);
const EmployeeProfilePage = lazy(() =>
  import("@/pages/EmployeeProfilePage").then((module) => ({ default: module.EmployeeProfilePage })),
);
const LoginPage = lazy(() =>
  import("@/pages/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const NotFoundPage = lazy(() =>
  import("@/pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })),
);
const ProjectDetailPage = lazy(() =>
  import("@/pages/ProjectDetailPage").then((module) => ({ default: module.ProjectDetailPage })),
);
const ProjectsPage = lazy(() =>
  import("@/pages/ProjectsPage").then((module) => ({ default: module.ProjectsPage })),
);

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

function RequireInternal({ children }: { children: React.ReactNode }) {
  const { isClient } = useAuth();
  if (isClient) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/attendance" element={<RequireInternal><AttendanceHubPage /></RequireInternal>} />
          <Route path="/leave-requests" element={<RequireInternal><Navigate to="/attendance?section=leave" replace /></RequireInternal>} />
          <Route
            path="/employees"
            element={
              <RequireManage>
                <EmployeeListPage />
              </RequireManage>
            }
          />
          <Route
            path="/employees/:memberId"
            element={
              <RequireManage>
                <EmployeeProfilePage />
              </RequireManage>
            }
          />
          <Route path="/my-profile" element={<EmployeeProfilePage self />} />
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
    </Suspense>
  );
}
