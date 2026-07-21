/**
 * pages/ProjectsPage.tsx
 * Card grid of every project the caller can see, with progress + risk.
 * Admins can create a project or import one from CSV. Clicking a card opens
 * the project detail.
 */
import { FolderKanban, Plus, Upload } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { CsvImportDialog } from "@/components/forms/CsvImportDialog";
import { ProjectFormDialog } from "@/components/forms/ProjectFormDialog";
import { ProjectStatusBadge } from "@/components/common/StatusBadge";
import { RiskBadge } from "@/components/common/RiskBadge";
import { ProjectGitHubButton } from "@/components/project/ProjectGitHubButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useProjectMutations, useProjects } from "@/hooks/useProjects";
import { formatDate } from "@/lib/utils";

export function ProjectsPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useProjects();
  const { create, update, importCsv } = useProjectMutations();
  const [formOpen, setFormOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg">Projects</h1>
          <p className="text-sm text-fg-muted">All tracked projects and their progress.</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCsvOpen(true)}>
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> New project
            </Button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}
      {isError && <ErrorState message="Could not load projects." onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description={isAdmin ? "Create one or import a CSV to get started." : "Nothing here yet."}
        />
      )}

      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer transition-colors hover:border-accent/60"
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <CardContent className="pt-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-fg">{p.name}</h3>
                  <div className="flex items-center gap-2">
                    <ProjectGitHubButton
                      project={p}
                      isAdmin={isAdmin}
                      onSave={(payload) => update.mutateAsync({ id: p.id, payload })}
                    />
                    <ProjectStatusBadge status={p.status} />
                  </div>
                </div>
                {p.description && (
                  <p className="mb-3 line-clamp-2 text-sm text-fg-muted">{p.description}</p>
                )}
                <div className="mb-3 flex items-center gap-2">
                  <RiskBadge risk={p.risk_level} />
                  <span className="text-xs text-fg-subtle">
                    {p.done_tasks}/{p.total_tasks} tasks · {p.milestone_count} milestones
                  </span>
                </div>
                <div className="mb-1 flex items-center justify-between text-xs text-fg-muted">
                  <span>Progress</span>
                  <span>{p.progress_pct}%</span>
                </div>
                <Progress value={p.progress_pct} />
                <p className="mt-3 text-xs text-fg-subtle">
                  {formatDate(p.start_date)} → {formatDate(p.end_date)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={(payload) => create.mutateAsync(payload)}
        isPending={create.isPending}
      />
      <CsvImportDialog
        open={csvOpen}
        onOpenChange={setCsvOpen}
        onImport={(file) => importCsv.mutateAsync(file)}
        isPending={importCsv.isPending}
      />
    </div>
  );
}
