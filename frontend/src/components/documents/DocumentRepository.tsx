/**
 * A focused two-level document workspace: collection first, category second.
 */
import {
  Archive,
  BarChart3,
  BookOpen,
  Boxes,
  ClipboardCheck,
  Code2,
  FileClock,
  FileText,
  FileStack,
  KeyRound,
  Network,
  RefreshCw,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { FolderSection } from "@/components/documents/FolderSection";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDocuments } from "@/hooks/useDocuments";
import { useMilestones } from "@/hooks/useMilestones";
import {
  getDocumentFolders,
  getDocumentPlacement,
  type DocumentCollectionKey,
  type DocumentFolderKey,
} from "@/lib/documentFolders";

const FOLDER_ICONS: Record<DocumentFolderKey, LucideIcon> = {
  asset_inventory: Boxes,
  technical_manual: BookOpen,
  software_manual: Code2,
  code_update: RefreshCw,
  updates: FileClock,
  credentials: KeyRound,
  testing: ClipboardCheck,
  incidents: ShieldAlert,
  kpi: BarChart3,
  client_report: FileText,
  nodes: Network,
};

export function DocumentRepository({
  projectId,
  workspace = "project",
  embedded = false,
}: {
  projectId: number;
  workspace?: "project" | "support";
  embedded?: boolean;
}) {
  const { data, isLoading, isError, refetch } = useDocuments(projectId);
  const milestones = useMilestones(projectId);
  const collection: DocumentCollectionKey = workspace === "support" ? "operations" : "project";
  const [folderKey, setFolderKey] = useState<DocumentFolderKey>("technical_manual");
  const folders = getDocumentFolders(collection);

  const placedDocuments = useMemo(
    () => (data ?? []).map((document) => ({ document, placement: getDocumentPlacement(document) })),
    [data],
  );

  if (isLoading || milestones.isLoading) return <DocumentWorkspaceSkeleton />;
  if (isError || milestones.isError)
    return (
      <ErrorState
        message="Could not load the document workspace."
        onRetry={() => {
          refetch();
          milestones.refetch();
        }}
      />
    );

  const activeFolder = folders.find((folder) => folder.key === folderKey) ?? folders[0];
  const activeDocuments = placedDocuments
    .filter((item) => item.placement.collection === collection && item.placement.folder === folderKey)
    .map((item) => item.document);
  const folderCount = (key: DocumentFolderKey) =>
    placedDocuments.filter(
      (item) => item.placement.collection === collection && item.placement.folder === key,
    ).length;

  return (
    <section
      aria-label={embedded ? "Project documents" : undefined}
      aria-labelledby={embedded ? undefined : "document-workspace-title"}
      className={embedded ? "pt-2" : "overflow-hidden rounded-xl border border-border bg-surface shadow-card"}
    >
      {!embedded && (
        <div className="border-b border-border bg-gradient-to-br from-accent-soft via-surface to-surface px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg shadow-sm">
              {workspace === "support" ? <Archive className="h-5 w-5" /> : <FileStack className="h-5 w-5" />}
            </span>
            <div>
              <h2 id="document-workspace-title" className="font-display text-lg font-semibold text-fg">
                {workspace === "support" ? "Service evidence & documents" : "Actual project documents"}
              </h2>
              <p className="mt-0.5 text-sm text-fg-muted">
                {workspace === "support"
                  ? "Store operational evidence, manuals, updates, client reports, and supporting records."
                  : "Delivery records, technical references, testing evidence, and project handover files."}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={embedded ? "py-3" : "px-5 py-5 sm:px-6"}>
        <Tabs value={folderKey} onValueChange={(value) => setFolderKey(value as DocumentFolderKey)}>
          <div className={embedded ? "overflow-x-auto pb-2" : "-mx-5 overflow-x-auto px-5 pb-2 sm:-mx-6 sm:px-6"}>
            <TabsList className="w-max min-w-full flex-nowrap justify-start">
              {folders.map((folder) => {
                const Icon = FOLDER_ICONS[folder.key];
                return (
                  <TabsTrigger key={folder.key} value={folder.key} className="gap-2 whitespace-nowrap">
                    <Icon className="h-4 w-4" />
                    {folder.label}
                    <span className="rounded-full bg-raised px-1.5 py-0.5 text-[11px] tabular-nums text-fg-muted">
                      {folderCount(folder.key)}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </Tabs>

        <div className="mt-3 animate-fade-in" key={`${collection}-${folderKey}`}>
          <FolderSection
            projectId={projectId}
            collection={collection}
            folder={activeFolder}
            icon={FOLDER_ICONS[activeFolder.key]}
            documents={activeDocuments}
            milestones={milestones.data ?? []}
          />
        </div>
      </div>
    </section>
  );
}

function DocumentWorkspaceSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>
      <Skeleton className="mt-6 h-10 w-full" />
      <Skeleton className="mt-4 h-64 w-full" />
    </div>
  );
}
