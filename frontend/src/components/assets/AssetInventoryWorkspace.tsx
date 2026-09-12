import {
  Boxes,
  ChevronDown,
  Database,
  Download,
  FileText,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  Network,
  Plus,
  Server,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  exportAssetInventoryExcel,
  exportAssetInventoryPdf,
  type AssetPayload,
} from "@/api/assets";
import { AssetFormDialog } from "@/components/assets/AssetFormDialog";
import { AssetNetworkMatrix } from "@/components/assets/AssetNetworkMatrix";
import { AssetPortDialog } from "@/components/assets/AssetPortDialog";
import { AssetRegistryTable } from "@/components/assets/AssetRegistryTable";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { ExcelTransferDialog } from "@/components/forms/ExcelTransferDialog";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssetMutations, useAssets } from "@/hooks/useAssets";
import { getApiErrorMessage } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import type {
  AssetConnectionStatus,
  AssetPort,
  ProjectAsset,
} from "@/types";

type DeleteTarget =
  | { type: "asset"; asset: ProjectAsset }
  | { type: "port"; asset: ProjectAsset; port: AssetPort };

export function AssetInventoryWorkspace({
  projectId,
  canEdit,
}: {
  projectId: number;
  canEdit: boolean;
}) {
  const assetsQuery = useAssets(projectId);
  const mutations = useAssetMutations(projectId);
  const [assetOpen, setAssetOpen] = useState(false);
  const [portOpen, setPortOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<ProjectAsset>();
  const [portAsset, setPortAsset] = useState<ProjectAsset>();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>();
  const [actionError, setActionError] = useState("");
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const assets = assetsQuery.data ?? [];
  const metrics = useMemo(
    () => ({
      environments: new Set(assets.map((asset) => asset.environment)).size,
      ports: assets.reduce((total, asset) => total + asset.ports.length, 0),
      maintenance: assets.filter((asset) => asset.status === "maintenance").length,
    }),
    [assets],
  );

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape"
        && !assetOpen
        && !portOpen
        && !excelOpen
        && !deleteTarget
      ) setExpanded(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [assetOpen, deleteTarget, excelOpen, expanded, portOpen]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const closeMenu = (event: MouseEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) setExportMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExportMenuOpen(false);
    };
    document.addEventListener("mousedown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [exportMenuOpen]);

  if (assetsQuery.isLoading) return <Skeleton className="h-[32rem] w-full" />;
  if (assetsQuery.isError) {
    return (
      <ErrorState
        message="Could not load this project's asset inventory."
        onRetry={() => assetsQuery.refetch()}
      />
    );
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setActionError("");
    try {
      if (deleteTarget.type === "asset") {
        await mutations.deleteAsset.mutateAsync(deleteTarget.asset.id);
      } else {
        await mutations.deletePort.mutateAsync(deleteTarget.port.id);
      }
      setDeleteTarget(undefined);
    } catch (error) {
      setActionError(getApiErrorMessage(error, "Could not delete this record."));
    }
  }

  async function setConnection(
    sourceAssetId: number,
    portId: number,
    status: AssetConnectionStatus,
  ) {
    setActionError("");
    try {
      await mutations.setConnection.mutateAsync({ sourceAssetId, portId, status });
    } catch (error) {
      setActionError(getApiErrorMessage(error, "Could not update this connection."));
    }
  }

  async function saveAsset(payload: AssetPayload) {
    if (editingAsset) {
      return mutations.updateAsset.mutateAsync({ id: editingAsset.id, payload });
    }
    const created = await mutations.createAsset.mutateAsync(payload);
    setPortAsset(created);
    window.setTimeout(() => setPortOpen(true), 0);
    return created;
  }

  async function exportInventory(format: "pdf" | "xlsx") {
    setActionError("");
    setExporting(format);
    try {
      const blob = format === "pdf"
        ? await exportAssetInventoryPdf(projectId)
        : await exportAssetInventoryExcel(projectId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `trackerx-project-${projectId}-asset-inventory.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, `Could not export the asset inventory ${format.toUpperCase()}.`),
      );
    } finally {
      setExporting(null);
    }
  }

  const workspace = (
    <section
      className={cn(
        "rounded-xl border border-border bg-surface shadow-card",
        expanded
          ? "fixed inset-0 z-[45] flex h-[100dvh] w-screen flex-col overflow-hidden rounded-none border-0 shadow-none"
          : "overflow-hidden",
      )}
      aria-label="Project asset inventory"
      aria-modal={expanded || undefined}
      role={expanded ? "dialog" : undefined}
    >
      <div className="shrink-0 bg-accent px-5 py-5 text-accent-fg sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/20">
              <Boxes className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold text-white">Asset inventory</h2>
              <p className="mt-1 max-w-2xl text-sm text-white/75">
                One project register for infrastructure, ports, and network decisions.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => setExpanded((current) => !current)}
              title={expanded ? "Return to the project page" : "Open a full-screen inventory workspace"}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {expanded ? "Minimize" : "Maximize"}
            </Button>
            <div className="relative" ref={exportMenuRef}>
              <Button
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                disabled={exporting !== null || assets.length === 0}
                onClick={() => setExportMenuOpen((current) => !current)}
                aria-expanded={exportMenuOpen}
                aria-haspopup="menu"
                title={assets.length ? "Choose an export format" : "Add an asset before exporting"}
              >
                {exporting ? <Spinner /> : <Download className="h-4 w-4" />}
                Export
                <ChevronDown className={cn("h-4 w-4 transition-transform", exportMenuOpen && "rotate-180")} />
              </Button>
              {exportMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-surface p-1.5 text-fg shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent-soft"
                    onClick={() => {
                      setExportMenuOpen(false);
                      void exportInventory("pdf");
                    }}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><FileText className="h-4 w-4" /></span>
                    <span><span className="block text-sm font-semibold">PDF report</span><span className="block text-xs text-fg-muted">Print-ready inventory and matrix</span></span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent-soft"
                    onClick={() => {
                      setExportMenuOpen(false);
                      void exportInventory("xlsx");
                    }}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><FileSpreadsheet className="h-4 w-4" /></span>
                    <span><span className="block text-sm font-semibold">Excel workbook</span><span className="block text-xs text-fg-muted">Filterable tables and visual matrix</span></span>
                  </button>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => setExcelOpen(true)}
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel import / export
            </Button>
            {canEdit && (
              <Button
                className="bg-white text-accent hover:bg-accent-soft"
                onClick={() => {
                  setEditingAsset(undefined);
                  setAssetOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add asset
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-4">
        <div className="bg-surface p-3 sm:px-5">
          <Metric label="Assets" value={assets.length} icon={Server} />
        </div>
        <div className="bg-surface p-3 sm:px-5">
          <Metric label="Environments" value={metrics.environments} icon={Database} />
        </div>
        <div className="bg-surface p-3 sm:px-5">
          <Metric label="Tracked ports" value={metrics.ports} icon={Network} />
        </div>
        <div className="bg-surface p-3 sm:px-5">
          <Metric label="Maintenance" value={metrics.maintenance} icon={Wrench} />
        </div>
      </div>

      <div className={cn("p-4 sm:p-6", expanded && "min-h-0 flex-1 overflow-auto")}>
        <Tabs defaultValue="inventory">
          <TabsList className="grid w-full grid-cols-2 sm:max-w-lg">
            <TabsTrigger value="inventory" className="justify-center gap-2">
              <Server className="h-4 w-4" /> Asset register
            </TabsTrigger>
            <TabsTrigger value="matrix" className="justify-center gap-2">
              <Network className="h-4 w-4" /> Connectivity matrix
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventory">
            <AssetRegistryTable
              assets={assets}
              canEdit={canEdit}
              onAddPort={(asset) => {
                setPortAsset(asset);
                setPortOpen(true);
              }}
              onEdit={(asset) => {
                setEditingAsset(asset);
                setAssetOpen(true);
              }}
              onDeleteAsset={(asset) => setDeleteTarget({ type: "asset", asset })}
              onDeletePort={(asset, port) => setDeleteTarget({ type: "port", asset, port })}
            />
          </TabsContent>

          <TabsContent value="matrix">
            <AssetNetworkMatrix
              projectId={projectId}
              inventoryAssets={assets}
              canEdit={canEdit}
              isUpdating={mutations.setConnection.isPending}
              onSetConnection={setConnection}
            />
          </TabsContent>
        </Tabs>

        {actionError && <p className="mt-4 text-sm text-danger">{actionError}</p>}
      </div>

      <AssetFormDialog
        open={assetOpen}
        onOpenChange={setAssetOpen}
        asset={editingAsset}
        isPending={mutations.createAsset.isPending || mutations.updateAsset.isPending}
        onSubmit={saveAsset}
      />
      <AssetPortDialog
        open={portOpen}
        onOpenChange={setPortOpen}
        asset={portAsset}
        isPending={mutations.createPort.isPending}
        onSubmit={(payload) => {
          if (!portAsset) return Promise.reject(new Error("Select an asset first."));
          return mutations.createPort.mutateAsync({ assetId: portAsset.id, payload });
        }}
      />
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={deleteTarget?.type === "asset" ? "Delete asset" : "Delete destination port"}
        description={
          deleteTarget?.type === "asset"
            ? `Delete "${deleteTarget.asset.hostname}", its ports, and all related network rules?`
            : deleteTarget
              ? `Delete port ${deleteTarget.port.port}/${deleteTarget.port.protocol.toUpperCase()} from "${deleteTarget.asset.hostname}" and remove its network rules?`
              : ""
        }
        isPending={mutations.deleteAsset.isPending || mutations.deletePort.isPending}
        onConfirm={confirmDelete}
      />
      <ExcelTransferDialog
        open={excelOpen}
        onOpenChange={setExcelOpen}
        projectId={projectId}
        workspace="assets"
        canImport={canEdit}
        hasRecords={assets.length > 0}
      />
    </section>
  );

  return expanded ? createPortal(workspace, document.body) : workspace;
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Server;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
        <p className="font-display text-xl font-bold leading-tight text-fg">{value}</p>
      </div>
    </div>
  );
}
