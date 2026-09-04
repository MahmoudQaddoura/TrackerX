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
  const assets = useMemo(
    () =>
      inventoryAssets
        .filter((asset) => asset.environment === environment)
        .sort((left, right) => left.hostname.localeCompare(right.hostname))
        .map((asset) => ({
          ...asset,
          ports: [...asset.ports].sort(
            (left, right) => left.port - right.port || left.protocol.localeCompare(right.protocol),
          ),
        })),
    [environment, inventoryAssets],
  );
  const destinations = assets.filter((asset) => asset.ports.length > 0);
  const portCount = destinations.reduce((total, asset) => total + asset.ports.length, 0);

  return (
    <div className="mt-4">
      <div className="rounded-xl border border-accent/15 bg-accent-soft/35 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-accent">Connectivity from the asset register</h3>
            <p className="mt-1 max-w-2xl text-sm text-fg-muted">
              Source rows and destination ports are created automatically from the registered assets in this environment.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <span className="rounded-full border border-accent/15 bg-surface px-3 py-2 text-xs font-semibold text-accent">
              {assets.length} {assets.length === 1 ? "asset" : "assets"}
            </span>
            <span className="rounded-full border border-accent/15 bg-surface px-3 py-2 text-xs font-semibold text-accent">
              {portCount} destination {portCount === 1 ? "port" : "ports"}
            </span>
            <Select
              className="w-full bg-surface sm:w-52"
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as AssetEnvironment)}
              aria-label="Matrix environment"
            >
              {(availableEnvironments.length ? availableEnvironments : ASSET_ENVIRONMENTS).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-accent/10 pt-3 text-xs text-fg-muted">
          <Legend tone="connected" label="Connected" />
          <Legend tone="closed" label="Closed" />
          <Legend tone="not_needed" label="Not needed" />
          {canEdit && <span className="font-medium text-accent">Select a state to cycle: Not needed → Connected → Closed.</span>}
        </div>
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
        <div className="mt-4 max-h-[36rem] overflow-auto rounded-xl border border-accent/20 bg-surface shadow-sm">
          <table className="min-w-max border-separate border-spacing-0 text-center text-xs">
            <thead className="sticky top-0 z-20 text-white">
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 z-30 min-w-52 border-b border-r border-white/15 bg-accent px-4 py-3 text-left font-semibold text-white"
                >
                  <span className="block text-[10px] uppercase tracking-widest text-white/65">Asset register</span>
                  <span className="mt-1 block text-sm">Outbound source</span>
                </th>
                {destinations.map((destination) => (
                  <th
                    key={destination.id}
                    colSpan={destination.ports.length}
                    className="border-b border-r border-white/15 bg-accent px-3 py-2 font-semibold text-white"
                  >
                    <span className="font-mono">{destination.hostname}</span>
                    <span className="ml-2 font-mono font-normal text-white/65">{destination.ip_address}</span>
                  </th>
                ))}
              </tr>
              <tr>
                {destinations.flatMap((destination) =>
                  destination.ports.map((port) => (
                    <th
                      key={port.id}
                      className="min-w-36 border-b border-r border-white/15 bg-accent/90 px-3 py-2 font-medium text-white"
                      title={port.notes || port.service}
                    >
                      <span className="block font-mono">{port.port}/{port.protocol.toUpperCase()}</span>
                      <span className="mt-0.5 block font-sans text-[11px] font-normal text-white/65">{port.service}</span>
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {assets.map((source, sourceIndex) => (
                <tr key={source.id} className="group">
                  <th className="sticky left-0 z-10 border-b border-r border-accent/15 bg-accent-soft px-4 py-3 text-left shadow-[3px_0_6px_rgba(15,82,116,0.06)]">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-accent/65">Source {sourceIndex + 1}</span>
                    <span className="block font-mono font-semibold text-fg">{source.hostname}</span>
                    <span className="mt-0.5 block font-mono font-normal text-accent">{source.ip_address}</span>
                  </th>
                  {destinations.flatMap((destination) =>
                    destination.ports.map((port) => {
                      if (source.id === destination.id) {
                        return (
                          <td key={port.id} className="border-b border-r border-accent/10 bg-accent-soft/45 px-2 py-3 text-fg-subtle">
                            <span className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-dashed border-accent/15 text-[11px] font-medium">
                              Same asset
                            </span>
                          </td>
                        );
                      }
                      const status =
                        connections.get(`${source.id}:${port.id}`) ?? "not_needed";
                      return (
                        <td
                          key={port.id}
                          className={cn(
                            "border-b border-r border-accent/10 p-2 transition-colors group-hover:bg-accent-soft/20",
                            status === "connected" && "bg-success/5",
                            status === "closed" && "bg-danger/5",
                            status === "not_needed" && "bg-raised/35",
                          )}
                        >
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
