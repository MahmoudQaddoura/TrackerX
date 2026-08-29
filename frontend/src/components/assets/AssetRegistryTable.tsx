import { Pencil, Plus, Search, Server, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { ASSET_ENVIRONMENTS } from "@/components/assets/AssetFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { AssetEnvironment, AssetPort, ProjectAsset } from "@/types";

export function AssetRegistryTable({
  assets,
  canEdit,
  onAddPort,
  onEdit,
  onDeleteAsset,
  onDeletePort,
}: {
  assets: ProjectAsset[];
  canEdit: boolean;
  onAddPort: (asset: ProjectAsset) => void;
  onEdit: (asset: ProjectAsset) => void;
  onDeleteAsset: (asset: ProjectAsset) => void;
  onDeletePort: (asset: ProjectAsset, port: AssetPort) => void;
}) {
  const [search, setSearch] = useState("");
  const [environment, setEnvironment] = useState<"all" | AssetEnvironment>("all");

  const visibleAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets.filter((asset) => {
      if (environment !== "all" && asset.environment !== environment) return false;
      if (!query) return true;
      return [
        asset.hostname,
        asset.ip_address,
        asset.purpose,
        asset.tier,
        asset.applications,
        asset.services,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [assets, environment, search]);

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-fg-subtle" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search hostname, IP, purpose, service…"
          />
        </div>
        <Select
          className="w-full sm:w-48"
          value={environment}
          onChange={(event) => setEnvironment(event.target.value as "all" | AssetEnvironment)}
          aria-label="Filter by environment"
        >
          <option value="all">All environments</option>
          {ASSET_ENVIRONMENTS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
      </div>

      {visibleAssets.length === 0 ? (
        <EmptyState
          icon={Server}
          title={assets.length ? "No matching assets" : "No assets recorded"}
          description={
            assets.length
              ? "Change the search or environment filter."
              : canEdit
                ? "Add the first project server, device, or network endpoint."
                : "No asset inventory has been added to this project."
          }
        />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
            <thead className="bg-raised text-xs uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Asset</th>
                <th className="px-4 py-3 font-semibold">Environment</th>
                <th className="px-4 py-3 font-semibold">Resources</th>
                <th className="px-4 py-3 font-semibold">Applications &amp; services</th>
                <th className="px-4 py-3 font-semibold">Destination ports</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                {canEdit && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleAssets.map((asset) => (
                <tr key={asset.id} className="align-top transition-colors hover:bg-raised/60">
                  <td className="px-4 py-4">
                    <p className="font-mono font-semibold text-fg">{asset.hostname}</p>
                    <p className="mt-1 font-mono text-xs text-accent">{asset.ip_address}</p>
                    <p className="mt-2 max-w-64 text-xs leading-5 text-fg-muted">
                      {asset.purpose || "No purpose recorded"}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <EnvironmentBadge environment={asset.environment} />
                    <p className="mt-2 text-xs text-fg-muted">{asset.tier || "No tier"}</p>
                  </td>
                  <td className="px-4 py-4 text-xs leading-5 text-fg-muted">
                    <p className="font-medium text-fg">{asset.os || "OS not recorded"}</p>
                    <p>{[asset.cpu, asset.ram, asset.storage].filter(Boolean).join(" · ") || "Resources not recorded"}</p>
                  </td>
                  <td className="px-4 py-4 text-xs leading-5 text-fg-muted">
                    <p><span className="font-medium text-fg">App:</span> {asset.applications || "—"}</p>
                    <p><span className="font-medium text-fg">DB:</span> {asset.database || "—"}</p>
                    <p><span className="font-medium text-fg">Services:</span> {asset.services || "—"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex max-w-72 flex-wrap gap-1.5">
                      {asset.ports.length === 0 && (
                        <span className="text-xs text-fg-subtle">No ports</span>
                      )}
                      {asset.ports.map((port) => (
                        <span
                          key={port.id}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-raised px-2 py-1 font-mono text-xs text-fg"
                          title={port.notes || port.service}
                        >
                          {port.port}/{port.protocol.toUpperCase()}
                          <span className="font-sans text-fg-muted">{port.service}</span>
                          {canEdit && (
                            <button
                              type="button"
                              className="ml-0.5 rounded text-fg-subtle hover:text-danger"
                              title={`Remove port ${port.port}`}
                              onClick={() => onDeletePort(asset, port)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4"><AssetStatusBadge status={asset.status} /></td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Add destination port" onClick={() => onAddPort(asset)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Edit asset" onClick={() => onEdit(asset)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete asset" onClick={() => onDeleteAsset(asset)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function EnvironmentBadge({ environment }: { environment: AssetEnvironment }) {
  const label = ASSET_ENVIRONMENTS.find((option) => option.value === environment)?.label ?? environment;
  return <Badge variant={environment === "production" ? "default" : "neutral"}>{label}</Badge>;
}

function AssetStatusBadge({ status }: { status: ProjectAsset["status"] }) {
  if (status === "active") return <Badge variant="success">Active</Badge>;
  if (status === "maintenance") return <Badge variant="warning">Maintenance</Badge>;
  return <Badge variant="neutral">{status === "inactive" ? "Inactive" : "Retired"}</Badge>;
}
