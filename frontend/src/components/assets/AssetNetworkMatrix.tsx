import { CircleDot, Network } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ASSET_ENVIRONMENTS } from "@/components/assets/AssetFormDialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssetMatrix } from "@/hooks/useAssets";
import { cn } from "@/lib/utils";
import type {
  AssetConnectionStatus,
  AssetEnvironment,
  ProjectAsset,
} from "@/types";

const CONNECTION_ORDER: AssetConnectionStatus[] = ["not_needed", "connected", "closed"];

export function AssetNetworkMatrix({
  projectId,
  inventoryAssets,
  canEdit,
  isUpdating,
  onSetConnection,
}: {
  projectId: number;
  inventoryAssets: ProjectAsset[];
  canEdit: boolean;
  isUpdating: boolean;
  onSetConnection: (
    sourceAssetId: number,
    portId: number,
    status: AssetConnectionStatus,
  ) => Promise<void>;
}) {
  const [environment, setEnvironment] = useState<AssetEnvironment>("production");
  const availableEnvironments = useMemo(
    () => ASSET_ENVIRONMENTS.filter((option) =>
      inventoryAssets.some((asset) => asset.environment === option.value),
    ),
    [inventoryAssets],
  );

  useEffect(() => {
    if (
      inventoryAssets.length > 0 &&
      !inventoryAssets.some((asset) => asset.environment === environment)
    ) {
      setEnvironment(inventoryAssets[0].environment);
    }
  }, [environment, inventoryAssets]);

  const matrix = useAssetMatrix(projectId, environment);
  const connections = useMemo(
    () =>
      new Map(
        (matrix.data?.connections ?? []).map((connection) => [
          `${connection.source_asset_id}:${connection.port_id}`,
          connection.status,
        ]),
      ),
    [matrix.data?.connections],
  );
  const assets = matrix.data?.assets ?? [];
  const destinations = assets.filter((asset) => asset.ports.length > 0);
  const portCount = destinations.reduce((total, asset) => total + asset.ports.length, 0);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-fg">Port-level connectivity</h3>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">
            Rows are outbound source IPs. Every destination port has its own connection state.
          </p>
        </div>
        <Select
          className="w-full sm:w-52"
          value={environment}
          onChange={(event) => setEnvironment(event.target.value as AssetEnvironment)}
          aria-label="Matrix environment"
        >
          {(availableEnvironments.length ? availableEnvironments : ASSET_ENVIRONMENTS).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-fg-muted">
        <Legend tone="connected" label="Connected" />
        <Legend tone="closed" label="Closed" />
        <Legend tone="not_needed" label="Not needed" />
        {canEdit && <span>Click a cell to change its state.</span>}
      </div>

      {matrix.isLoading ? (
        <Skeleton className="mt-4 h-72 w-full" />
      ) : matrix.isError ? (
        <ErrorState message="Could not load the network matrix." onRetry={() => matrix.refetch()} />
      ) : assets.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No assets in this environment"
          description="Add assets or select another environment."
        />
      ) : portCount === 0 ? (
        <EmptyState
          icon={CircleDot}
          title="No destination ports"
          description={canEdit ? "Add a port from the Inventory tab to start the matrix." : undefined}
        />
      ) : (
        <div className="mt-4 max-h-[34rem] overflow-auto rounded-lg border border-border">
          <table className="min-w-max border-separate border-spacing-0 text-center text-xs">
            <thead className="sticky top-0 z-20 bg-raised">
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 z-30 min-w-52 border-b border-r border-border bg-raised px-4 py-3 text-left font-semibold text-fg"
                >
                  Outbound source
                </th>
                {destinations.map((destination) => (
                  <th
                    key={destination.id}
                    colSpan={destination.ports.length}
                    className="border-b border-r border-border px-3 py-2 font-semibold text-fg"
                  >
                    <span className="font-mono">{destination.hostname}</span>
                    <span className="ml-2 font-mono font-normal text-fg-muted">{destination.ip_address}</span>
                  </th>
                ))}
              </tr>
              <tr>
                {destinations.flatMap((destination) =>
                  destination.ports.map((port) => (
                    <th
                      key={port.id}
                      className="min-w-32 border-b border-r border-border bg-raised px-3 py-2 font-medium text-fg"
                      title={port.notes || port.service}
                    >
                      <span className="block font-mono">{port.port}/{port.protocol.toUpperCase()}</span>
                      <span className="mt-0.5 block font-sans text-[11px] font-normal text-fg-muted">{port.service}</span>
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {assets.map((source) => (
                <tr key={source.id} className="hover:bg-raised/50">
                  <th className="sticky left-0 z-10 border-b border-r border-border bg-surface px-4 py-3 text-left">
                    <span className="block font-mono font-semibold text-fg">{source.hostname}</span>
                    <span className="mt-0.5 block font-mono font-normal text-accent">{source.ip_address}</span>
                  </th>
                  {destinations.flatMap((destination) =>
                    destination.ports.map((port) => {
                      if (source.id === destination.id) {
                        return (
                          <td key={port.id} className="border-b border-r border-border bg-raised/60 px-2 py-3 text-fg-subtle">
                            —
                          </td>
                        );
                      }
                      const status =
                        connections.get(`${source.id}:${port.id}`) ?? "not_needed";
                      return (
                        <td key={port.id} className="border-b border-r border-border p-2">
                          <ConnectionButton
                            status={status}
                            disabled={!canEdit || isUpdating}
                            onClick={() =>
                              onSetConnection(source.id, port.id, nextConnectionStatus(status))
                            }
                          />
                        </td>
                      );
                    }),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Legend({
  tone,
  label,
}: {
  tone: AssetConnectionStatus;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          tone === "connected" && "bg-success",
          tone === "closed" && "bg-danger",
          tone === "not_needed" && "bg-fg-subtle",
        )}
      />
      {label}
    </span>
  );
}

function ConnectionButton({
  status,
  disabled,
  onClick,
}: {
  status: AssetConnectionStatus;
  disabled: boolean;
  onClick: () => void;
}) {
  const label =
    status === "connected" ? "Connected" : status === "closed" ? "Closed" : "Not needed";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? label : `${label}. Click to change.`}
      className={cn(
        "inline-flex min-w-24 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1.5 font-medium transition-colors disabled:cursor-default",
        status === "connected" && "border-success/30 bg-success/10 text-success",
        status === "closed" && "border-danger/30 bg-danger/10 text-danger",
        status === "not_needed" && "border-border bg-raised text-fg-muted",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "connected" && "bg-success",
          status === "closed" && "bg-danger",
          status === "not_needed" && "bg-fg-subtle",
        )}
      />
      {label}
    </button>
  );
}

function nextConnectionStatus(status: AssetConnectionStatus): AssetConnectionStatus {
  const current = CONNECTION_ORDER.indexOf(status);
  return CONNECTION_ORDER[(current + 1) % CONNECTION_ORDER.length];
}
