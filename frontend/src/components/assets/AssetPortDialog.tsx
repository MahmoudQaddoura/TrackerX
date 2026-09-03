import { useEffect, useState } from "react";

import type { AssetPortPayload } from "@/api/assets";
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
import { getApiErrorMessage } from "@/lib/apiClient";
import type { AssetProtocol, ProjectAsset } from "@/types";

const COMMON_PORTS = [
  { port: 443, protocol: "tcp" as const, service: "HTTPS" },
  { port: 80, protocol: "tcp" as const, service: "HTTP" },
  { port: 22, protocol: "tcp" as const, service: "SSH" },
  { port: 5432, protocol: "tcp" as const, service: "PostgreSQL" },
  { port: 3306, protocol: "tcp" as const, service: "MySQL" },
  { port: 53, protocol: "udp" as const, service: "DNS" },
];

export function AssetPortDialog({
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
  onSubmit: (payload: AssetPortPayload) => Promise<unknown>;
}) {
  const [port, setPort] = useState("");
  const [protocol, setProtocol] = useState<AssetProtocol>("tcp");
  const [service, setService] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setPort("");
    setProtocol("tcp");
    setService("");
    setNotes("");
    setError("");
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit({
        port: Number(port),
        protocol,
        service,
        notes: notes || null,
      });
      onOpenChange(false);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Could not add this port."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add destination port</DialogTitle>
          <DialogDescription>
            {asset
              ? `Add a separately tracked inbound port to ${asset.hostname} (${asset.ip_address}).`
              : "Add a separately tracked inbound port."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="rounded-lg border border-border bg-accent-soft/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Common ports</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {COMMON_PORTS.map((option) => (
                <button
                  key={`${option.port}-${option.protocol}`}
                  type="button"
                  className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg hover:border-accent/40 hover:bg-accent-soft"
                  onClick={() => {
                    setPort(String(option.port));
                    setProtocol(option.protocol);
                    setService(option.service);
                  }}
                >
                  {option.port}/{option.protocol.toUpperCase()} · {option.service}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Port *</Label>
              <Input
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(event) => setPort(event.target.value)}
                placeholder="443"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Protocol</Label>
              <Select value={protocol} onChange={(event) => setProtocol(event.target.value as AssetProtocol)}>
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Service *</Label>
            <Input value={service} onChange={(event) => setService(event.target.value)} placeholder="HTTPS" required />
          </div>
          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional port purpose" />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Done for now</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Adding…" : "Add port"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
