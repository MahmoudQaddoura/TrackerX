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
  Wrench,
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
  DOCUMENT_COLLECTIONS,
  getDocumentFolders,
  getDocumentPlacement,
  type DocumentCollectionKey,
  type DocumentFolderKey,
} from "@/lib/documentFolders";
import { cn } from "@/lib/utils";

const COLLECTION_ICONS: Record<DocumentCollectionKey, LucideIcon> = {
  project: FileStack,
  operations: Wrench,
};

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

export function DocumentRepository({ projectId }: { projectId: number }) {
  const { data, isLoading, isError, refetch } = useDocuments(projectId);
  const milestones = useMilestones(projectId);
  const [collection, setCollection] = useState<DocumentCollectionKey>("project");
  const [folderKey, setFolderKey] = useState<DocumentFolderKey>("asset_inventory");
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
  const collectionCount = (key: DocumentCollectionKey) =>
    placedDocuments.filter((item) => item.placement.collection === key).length;
  const folderCount = (key: DocumentFolderKey) =>
    placedDocuments.filter(
      (item) => item.placement.collection === collection && item.placement.folder === key,
    ).length;

  return (
    <section aria-labelledby="document-workspace-title" className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="border-b border-border bg-gradient-to-br from-accent-soft via-surface to-surface px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg shadow-sm">
            <Archive className="h-5 w-5" />
          </span>
          <div>
            <h2 id="document-workspace-title" className="font-display text-lg font-semibold text-fg">
              Document control
            </h2>
            <p className="mt-0.5 text-sm text-fg-muted">
              Choose a document collection, then open the category you need.
            </p>
          </div>
        </div>

        <Tabs
          value={collection}
          onValueChange={(value) => {
            const nextCollection = value as DocumentCollectionKey;
            setCollection(nextCollection);
            setFolderKey(getDocumentFolders(nextCollection)[0].key);
          }}
          className="mt-5"
        >
          <TabsList className="grid w-full grid-cols-1 gap-2 border-0 bg-transparent p-0 sm:grid-cols-2">
            {DOCUMENT_COLLECTIONS.map((item) => {
              const Icon = COLLECTION_ICONS[item.key];
              const count = collectionCount(item.key);
              return (
                <TabsTrigger
                  key={item.key}
                  value={item.key}
                  className={cn(
                    "group min-h-20 justify-start gap-3 border border-border bg-surface px-4 py-3 text-left shadow-sm",
                    "hover:border-accent/40 hover:bg-accent-soft/40",
                    "data-[state=active]:border-accent data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:ring-1 data-[state=active]:ring-accent/20",
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-raised text-fg-muted group-data-[state=active]:bg-accent group-data-[state=active]:text-accent-fg">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{item.label}</span>
                      <span className="rounded-full bg-raised px-2 py-0.5 text-xs tabular-nums text-fg-muted">
                        {count}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-normal text-fg-subtle">
                      {item.description}
                    </span>
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <Tabs value={folderKey} onValueChange={(value) => setFolderKey(value as DocumentFolderKey)}>
          <div className="-mx-5 overflow-x-auto px-5 pb-2 sm:-mx-6 sm:px-6">
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
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="mt-6 h-10 w-full" />
      <Skeleton className="mt-4 h-64 w-full" />
    </div>
  );
}
