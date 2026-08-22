import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, SearchCheck } from "lucide-react";

import type { SupportIncidentPayload } from "@/api/support";
import { AssigneePicker } from "@/components/support/AssigneePicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/apiClient";
import type {
  SupportIncident,
  SupportIncidentSeverity,
  SupportIncidentStatus,
} from "@/types";

const STATUS_OPTIONS: { value: SupportIncidentStatus; label: string }[] = [
  { value: "reported", label: "Reported" },
  { value: "investigating", label: "Investigating" },
  { value: "resolved", label: "Resolved" },
  { value: "unresolved", label: "Not Resolved" },
];

const SEVERITY_OPTIONS: { value: SupportIncidentSeverity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function toDateTimeInput(value?: string | null): string {
  if (!value) return "";
  return value.slice(0, 16);
}

function nowForInput(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

export function IncidentDialog({
  open,
  onOpenChange,
  incident,
  readOnly = false,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident?: SupportIncident;
  readOnly?: boolean;
  isPending?: boolean;
  onSubmit: (payload: SupportIncidentPayload) => Promise<unknown>;
}) {
  const { canManage } = useAuth();
  const [title, setTitle] = useState("");
  const [clientReport, setClientReport] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [reportedAt, setReportedAt] = useState("");
  const [severity, setSeverity] = useState<SupportIncidentSeverity>("medium");
  const [recommendation, setRecommendation] = useState("");
  const [investigation, setInvestigation] = useState("");
  const [responseAt, setResponseAt] = useState("");
  const [responseDescription, setResponseDescription] = useState("");
  const [status, setStatus] = useState<SupportIncidentStatus>("reported");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(incident?.title ?? "");
    setClientReport(incident?.client_report ?? "");
    setReason(incident?.reason ?? "");
    setDescription(incident?.description ?? "");
    setReportedAt(toDateTimeInput(incident?.reported_at) || nowForInput());
    setSeverity(incident?.severity ?? "medium");
    setRecommendation(incident?.recommendation ?? "");
    setInvestigation(incident?.investigation ?? "");
    setResponseAt(toDateTimeInput(incident?.response_at));
    setResponseDescription(incident?.response_description ?? "");
    setStatus(incident?.status ?? "reported");
    setResolutionNotes(incident?.resolution_notes ?? "");
    setAssigneeIds(incident?.assigned_members.map((member) => member.id) ?? []);
    setError(null);
  }, [incident, open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setError("Incident title is required.");
    if (!reportedAt) return setError("Time reported is required.");
    if (responseAt && responseAt < reportedAt) {
      return setError("Response time cannot be before the incident was reported.");
    }
    if (
      (status === "resolved" || status === "unresolved") &&
      (!investigation.trim() || !responseAt || !responseDescription.trim() || !resolutionNotes.trim())
    ) {
      return setError(
        "A closed response needs the investigation, response time, response description, and resolution notes.",
      );
    }
    try {
      const payload: SupportIncidentPayload = {
        title: title.trim(),
        client_report: clientReport.trim() || null,
        reason: reason.trim() || null,
        description: description.trim() || null,
        reported_at: reportedAt,
        severity,
        recommendation: recommendation.trim() || null,
        investigation: investigation.trim() || null,
        response_at: responseAt || null,
        response_description: responseDescription.trim() || null,
        status,
        resolution_notes: resolutionNotes.trim() || null,
      };
      if (canManage) payload.assigned_member_ids = assigneeIds;
      await onSubmit(payload);
      onOpenChange(false);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{incident ? "Incident and response record" : "Report an incident"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <section className="rounded-lg border border-danger/25 bg-danger/5 p-4">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-danger" />
              <h3 className="font-semibold text-fg">1. Incident report</h3>
              {incident && <Badge variant="outline">INC-{String(incident.id).padStart(4, "0")}</Badge>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="incident-title">Incident / task</Label>
                <Input id="incident-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Describe the required response task" disabled={readOnly} required />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="incident-client">Client report</Label>
                <Textarea id="incident-client" value={clientReport} onChange={(event) => setClientReport(event.target.value)} placeholder="Record what the client reported, including any reference or ticket number." disabled={readOnly} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="incident-time">Time reported</Label>
                <Input id="incident-time" type="datetime-local" value={reportedAt} onChange={(event) => setReportedAt(event.target.value)} disabled={readOnly} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="incident-severity">Severity</Label>
                <Select id="incident-severity" value={severity} onChange={(event) => setSeverity(event.target.value as SupportIncidentSeverity)} disabled={readOnly}>
                  {SEVERITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </div>
              <IncidentField id="incident-reason" label="Reason / suspected cause" value={reason} onChange={setReason} placeholder="What caused or may have caused the incident?" disabled={readOnly} />
              <IncidentField id="incident-description" label="Description and impact" value={description} onChange={setDescription} placeholder="Systems affected, symptoms, users impacted, and current condition." disabled={readOnly} />
              <div className="sm:col-span-2">
                <IncidentField id="incident-recommendation" label="Recommended method" value={recommendation} onChange={setRecommendation} placeholder="Immediate containment or recommended handling method." disabled={readOnly} />
              </div>
            </div>
          </section>

          <AssigneePicker selectedIds={assigneeIds} onChange={setAssigneeIds} disabled={readOnly || !canManage} />

          <section className="rounded-lg border border-accent/25 bg-accent-soft/25 p-4">
            <div className="mb-4 flex items-center gap-2">
              <SearchCheck className="h-4 w-4 text-accent" />
              <h3 className="font-semibold text-fg">2. Investigation and response</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="incident-status">Resolution status</Label>
                <Select id="incident-status" value={status} onChange={(event) => setStatus(event.target.value as SupportIncidentStatus)} disabled={readOnly}>
                  {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="response-time">Response time</Label>
                <Input id="response-time" type="datetime-local" value={responseAt} onChange={(event) => setResponseAt(event.target.value)} disabled={readOnly} />
              </div>
              <div className="sm:col-span-2">
                <IncidentField id="investigation" label="Investigation" value={investigation} onChange={setInvestigation} placeholder="Diagnostic steps, evidence reviewed, root cause, and technical findings." disabled={readOnly} />
              </div>
              <div className="sm:col-span-2">
                <IncidentField id="response-description" label="Response description" value={responseDescription} onChange={setResponseDescription} placeholder="Actions taken, communication, validation, and service recovery." disabled={readOnly} />
              </div>
              <div className="sm:col-span-2">
                <IncidentField id="resolution-notes" label="Resolution / unresolved notes" value={resolutionNotes} onChange={setResolutionNotes} placeholder="Confirm the resolution and prevention steps, or explain why it remains unresolved." disabled={readOnly} />
              </div>
            </div>
          </section>

          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{readOnly ? "Close" : "Cancel"}</Button>
            {!readOnly && <Button type="submit" disabled={isPending}>{isPending && <Spinner />} Save incident</Button>}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IncidentField({ id, label, value, onChange, placeholder, disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} disabled={disabled} />
    </div>
  );
}
