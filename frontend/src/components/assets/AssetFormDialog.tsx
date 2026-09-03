import { ChevronDown, Database, Globe2, Network, Server } from "lucide-react";
import { useEffect, useState } from "react";

import type { AssetPayload } from "@/api/assets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/apiClient";
import type { AssetEnvironment, AssetStatus, ProjectAsset } from "@/types";

export const ASSET_ENVIRONMENTS: { value: AssetEnvironment; label: string }[] = [
  { value: "production", label: "Production" },
  { value: "staging", label: "Staging" },
  { value: "development", label: "Development" },
  { value: "test", label: "Test" },
  { value: "disaster_recovery", label: "Disaster recovery" },
  { value: "other", label: "Other" },
];

const INITIAL: AssetPayload = {
  hostname: "",
  ip_address: "",
  environment: "production",
  purpose: "",
  tier: "",
  os: "",
  cpu: "",
  ram: "",
  storage: "",
  applications: "",
  database: "",
  services: "",
  status: "active",
  notes: "",
};

const ASSET_TEMPLATES: {
  label: string;
  description: string;
  icon: typeof Server;
  values: Partial<AssetPayload>;
}[] = [
  {
    label: "Web server",
    description: "Frontend or reverse proxy",
    icon: Globe2,
    values: { purpose: "Web frontend", tier: "Web" },
  },
  {
    label: "Application server",
    description: "APIs and business services",
    icon: Server,
    values: { purpose: "Application backend", tier: "Application" },
  },
  {
    label: "Database server",
    description: "Managed data workload",
    icon: Database,
    values: { purpose: "Database server", tier: "Database" },
  },
  {
    label: "Network device",
    description: "Gateway, switch, or appliance",
    icon: Network,
    values: { purpose: "Network infrastructure", tier: "Network" },
  },
];

export function AssetFormDialog({
  open,
  onOpenChange,
  asset,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: ProjectAsset;
  isPending: boolean;
  onSubmit: (payload: AssetPayload) => Promise<unknown>;
}) {
  const [form, setForm] = useState<AssetPayload>(INITIAL);
  const [error, setError] = useState("");
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setShowTechnical(Boolean(asset));
    setForm(
      asset
        ? {
            hostname: asset.hostname,
            ip_address: asset.ip_address,
            environment: asset.environment,
            purpose: asset.purpose ?? "",
            tier: asset.tier ?? "",
            os: asset.os ?? "",
            cpu: asset.cpu ?? "",
            ram: asset.ram ?? "",
            storage: asset.storage ?? "",
            applications: asset.applications ?? "",
            database: asset.database ?? "",
            services: asset.services ?? "",
            status: asset.status,
            notes: asset.notes ?? "",
          }
        : INITIAL,
    );
  }, [asset, open]);

  const set = <K extends keyof AssetPayload>(key: K, value: AssetPayload[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit(form);
      onOpenChange(false);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Could not save this asset."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{asset ? "Edit asset" : "Add infrastructure asset"}</DialogTitle>
          <DialogDescription>
            Start with the identity fields. Technical details can be completed now or later.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          {!asset && (
            <div className="rounded-lg border border-border bg-accent-soft/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Quick start</p>
              <p className="mt-1 text-xs text-fg-muted">
                Choose a type to prefill its purpose and tier. You can change every value.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {ASSET_TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  return (
                    <button
                      key={template.label}
                      type="button"
                      className="flex items-start gap-2 rounded-md border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-accent/40 hover:bg-accent-soft"
                      onClick={() => setForm((current) => ({ ...current, ...template.values }))}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span>
                        <span className="block text-xs font-semibold text-fg">{template.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-4 text-fg-muted">{template.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 border-b border-border pb-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-fg">1</span>
            <div>
              <h3 className="text-sm font-semibold text-fg">Identity and ownership</h3>
              <p className="text-xs text-fg-muted">Hostname and IP must be unique inside this project.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hostname" required>
              <Input
                autoFocus
                value={form.hostname}
                onChange={(event) => set("hostname", event.target.value)}
                placeholder="prod-app-01"
                required
              />
            </Field>
            <Field label="IP address" required>
              <Input
                value={form.ip_address}
                onChange={(event) => set("ip_address", event.target.value)}
                placeholder="10.10.1.20"
                required
              />
            </Field>
            <Field label="Environment">
              <Select
                value={form.environment}
                onChange={(event) => set("environment", event.target.value as AssetEnvironment)}
              >
                {ASSET_ENVIRONMENTS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(event) => set("status", event.target.value as AssetStatus)}
              >
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
                <option value="retired">Retired</option>
              </Select>
            </Field>
            <Field label="Purpose">
              <Input value={form.purpose ?? ""} onChange={(event) => set("purpose", event.target.value)} placeholder="Application backend" />
            </Field>
            <Field label="Tier">
              <Input value={form.tier ?? ""} onChange={(event) => set("tier", event.target.value)} placeholder="Application" />
            </Field>
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg border border-border bg-raised/50 px-4 py-3 text-left hover:bg-raised"
            aria-expanded={showTechnical}
            onClick={() => setShowTechnical((current) => !current)}
          >
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">2</span>
              <span>
                <span className="block text-sm font-semibold text-fg">Technical details</span>
                <span className="block text-xs text-fg-muted">Capacity, platform, and installed workloads</span>
              </span>
            </span>
            <ChevronDown className={`h-4 w-4 text-fg-muted transition-transform ${showTechnical ? "rotate-180" : ""}`} />
          </button>

          {showTechnical && (
            <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
              <Field label="Operating system">
                <Input value={form.os ?? ""} onChange={(event) => set("os", event.target.value)} placeholder="Rocky Linux 9" />
              </Field>
              <Field label="CPU">
                <Input value={form.cpu ?? ""} onChange={(event) => set("cpu", event.target.value)} placeholder="8 vCPU" />
              </Field>
              <Field label="RAM">
                <Input value={form.ram ?? ""} onChange={(event) => set("ram", event.target.value)} placeholder="32 GB" />
              </Field>
              <Field label="Storage">
                <Input value={form.storage ?? ""} onChange={(event) => set("storage", event.target.value)} placeholder="500 GB SSD" />
              </Field>
              <Field label="Applications">
                <Input value={form.applications ?? ""} onChange={(event) => set("applications", event.target.value)} placeholder="Core API" />
              </Field>
              <Field label="Database">
                <Input value={form.database ?? ""} onChange={(event) => set("database", event.target.value)} placeholder="PostgreSQL 16" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Services">
                  <Input value={form.services ?? ""} onChange={(event) => set("services", event.target.value)} placeholder="Docker, Nginx" />
                </Field>
              </div>
            </div>
          )}

          <Field label="Notes">
            <Textarea value={form.notes ?? ""} onChange={(event) => set("notes", event.target.value)} placeholder="Operational context, ownership, or maintenance notes" />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : asset ? "Save changes" : "Save and add ports"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}{required ? " *" : ""}</Label>
      {children}
    </div>
  );
}
