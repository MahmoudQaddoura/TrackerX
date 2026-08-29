import { Boxes, Database, Network, Plus, Server, Wrench } from "lucide-react";
import { useMemo, useState } from "react";

import type { AssetPayload } from "@/api/assets";
import { AssetFormDialog } from "@/components/assets/AssetFormDialog";
import { AssetNetworkMatrix } from "@/components/assets/AssetNetworkMatrix";
import { AssetPortDialog } from "@/components/assets/AssetPortDialog";
import { AssetRegistryTable } from "@/components/assets/AssetRegistryTable";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssetMutations, useAssets } from "@/hooks/useAssets";
import { getApiErrorMessage } from "@/lib/apiClient";
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

  const assets = assetsQuery.data ?? [];
  const metrics = useMemo(
    () => ({
      environments: new Set(assets.map((asset) => asset.environment)).size,
      ports: assets.reduce((total, asset) => total + asset.ports.length, 0),
      maintenance: assets.filter((asset) => asset.status === "maintenance").length,
    }),
    [assets],
  );

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

  function saveAsset(payload: AssetPayload) {
    return editingAsset
      ? mutations.updateAsset.mutateAsync({ id: editingAsset.id, payload })
      : mutations.createAsset.mutateAsync(payload);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="border-b border-border bg-gradient-to-r from-accent-soft/80 via-surface to-surface px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg">
              <Boxes className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold text-fg">Asset inventory</h2>
              <p className="mt-1 max-w-2xl text-sm text-fg-muted">
                Project-owned infrastructure, destination ports, and source-to-port connectivity.
              </p>
            </div>
          </div>
          {canEdit && (
            <Button
              onClick={() => {
                setEditingAsset(undefined);
                setAssetOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add asset
            </Button>
          )}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Assets" value={assets.length} icon={Server} />
          <Metric label="Environments" value={metrics.environments} icon={Database} />
          <Metric label="Tracked ports" value={metrics.ports} icon={Network} />
          <Metric label="Maintenance" value={metrics.maintenance} icon={Wrench} />
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <Tabs defaultValue="inventory">
          <TabsList className="grid w-full grid-cols-2 sm:max-w-md">
            <TabsTrigger value="inventory" className="justify-center gap-2">
              <Server className="h-4 w-4" /> Inventory
            </TabsTrigger>
            <TabsTrigger value="matrix" className="justify-center gap-2">
              <Network className="h-4 w-4" /> Network matrix
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
    </section>
  );
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
    <div className="rounded-lg border border-border/80 bg-surface/85 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <Icon className="h-4 w-4 text-accent" />
      </div>
      <p className="mt-1 font-display text-xl font-bold text-fg">{value}</p>
    </div>
  );
}
