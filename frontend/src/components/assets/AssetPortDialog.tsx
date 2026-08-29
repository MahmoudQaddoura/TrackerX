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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Adding…" : "Add port"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
