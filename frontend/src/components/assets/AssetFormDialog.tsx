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

  useEffect(() => {
    if (!open) return;
    setError("");
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
          <DialogTitle>{asset ? "Edit asset" : "Add asset"}</DialogTitle>
          <DialogDescription>
            Record one server, device, or infrastructure endpoint inside this project.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
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
          </div>
          <Field label="Services">
            <Input value={form.services ?? ""} onChange={(event) => set("services", event.target.value)} placeholder="Docker, Nginx" />
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes ?? ""} onChange={(event) => set("notes", event.target.value)} placeholder="Operational context, ownership, or maintenance notes" />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save asset"}</Button>
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
