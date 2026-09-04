import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { ClientProfile, Project } from "@/types";

export function ForwardReportDialog({ open, onOpenChange, project, report, reportType = "proactive", clients, isPending, onForward }: { open: boolean; onOpenChange: (open: boolean) => void; project: Project; report?: { id: number; title: string; status: string }; reportType?: "proactive" | "incident"; clients: ClientProfile[]; isPending: boolean; onForward: (clientId: number, message: string | null) => Promise<unknown> }) {
  const [clientId, setClientId] = useState("");
  const [message, setMessage] = useState("");
  const eligible = useMemo(() => clients.filter((client) => client.projects.some((linked) => linked.id === project.id || linked.id === project.parent_project_id)), [clients, project.id, project.parent_project_id]);
  useEffect(() => { if (open) { setClientId(eligible.length === 1 ? String(eligible[0].id) : ""); setMessage(""); } }, [open, eligible]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!clientId) return;
    await onForward(Number(clientId), message.trim() || null);
    onOpenChange(false);
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Forward report to client</DialogTitle><p className="text-sm text-fg-muted">Send the finalized report to a client linked to {project.parent_project_name || project.name}. It will appear immediately in their secure portal.</p></DialogHeader>{report && <form onSubmit={submit} className="space-y-4"><div className="rounded-lg border border-accent/20 bg-accent-soft/50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-accent">{reportType === "incident" ? "Closed incident report" : "Completed service report"}</p><p className="mt-1 font-semibold text-fg">{report.title}</p><p className="mt-1 text-xs text-fg-muted">The client receives report content without internal employee assignment details.</p></div>{eligible.length ? <><div className="space-y-1.5"><Label htmlFor="forward-client">Client</Label><Select id="forward-client" value={clientId} onChange={(event) => setClientId(event.target.value)} required><option value="">Select linked client...</option>{eligible.map((client) => <option key={client.id} value={client.id}>{client.organization || client.full_name} — {client.full_name}</option>)}</Select></div><div className="space-y-1.5"><Label htmlFor="forward-message">Client message (optional)</Label><Textarea id="forward-message" rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Add context or the recommended next action." /></div></> : <div className="flex gap-3 rounded-lg border border-warning/25 bg-warning/10 p-4"><Building2 className="h-5 w-5 shrink-0 text-warning" /><div><p className="font-medium text-fg">No linked client</p><p className="text-sm text-fg-muted">Assign a client to the parent project before forwarding this report.</p></div></div>}<DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!clientId || isPending}>{isPending ? <Spinner /> : <Send className="h-4 w-4" />} Forward to portal</Button></DialogFooter></form>}</DialogContent></Dialog>;
}
