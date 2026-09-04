import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Radar, SearchCheck, ShieldCheck } from "lucide-react";

import type { SupportIncidentPayload } from "@/api/support";
import { AssigneePicker } from "@/components/support/AssigneePicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useTeam } from "@/hooks/useTeam";
import { getApiErrorMessage } from "@/lib/apiClient";
import type { SupportIncident, SupportIncidentSeverity, SupportIncidentStatus } from "@/types";

type DetectionSource = SupportIncident["detection_source"];
type Phase = "incident" | "response";

const STATUS_OPTIONS: { value: SupportIncidentStatus; label: string }[] = [
  { value: "investigating", label: "Investigation in progress" },
  { value: "resolved", label: "Resolved" },
  { value: "unresolved", label: "Closed - unresolved" },
];
const SEVERITY_OPTIONS: { value: SupportIncidentSeverity; label: string; detail: string }[] = [
  { value: "low", label: "Low", detail: "Limited impact; normal response queue" },
  { value: "medium", label: "Medium", detail: "Degraded service or several users affected" },
  { value: "high", label: "High", detail: "Major service impact; urgent response" },
  { value: "critical", label: "Critical", detail: "Outage, security breach, or severe business impact" },
];
const SOURCE_OPTIONS: { value: DetectionSource; label: string }[] = [
  { value: "client", label: "Client reported" },
  { value: "team", label: "Team member discovered" },
  { value: "monitoring", label: "Monitoring or alert" },
  { value: "third_party", label: "Third party or supplier" },
];

function toDateTimeInput(value?: string | null): string { return value ? value.slice(0, 16) : ""; }
function nowForInput(): string { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }

export function IncidentDialog({ open, onOpenChange, incident, readOnly = false, isPending, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; incident?: SupportIncident; readOnly?: boolean; isPending?: boolean; onSubmit: (payload: SupportIncidentPayload) => Promise<unknown> }) {
  const { canManage } = useAuth();
  const team = useTeam(true);
  const [phase, setPhase] = useState<Phase>("incident");
  const [title, setTitle] = useState("");
  const [detectionSource, setDetectionSource] = useState<DetectionSource>("team");
  const [reportedByName, setReportedByName] = useState("");
  const [affectedService, setAffectedService] = useState("");
  const [initialEvidence, setInitialEvidence] = useState("");
  const [suspectedCause, setSuspectedCause] = useState("");
  const [impact, setImpact] = useState("");
  const [reportedAt, setReportedAt] = useState("");
  const [severity, setSeverity] = useState<SupportIncidentSeverity>("medium");
  const [recommendation, setRecommendation] = useState("");
  const [containment, setContainment] = useState("");
  const [investigation, setInvestigation] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [responseAt, setResponseAt] = useState("");
  const [responseDescription, setResponseDescription] = useState("");
  const [recoveryValidation, setRecoveryValidation] = useState("");
  const [status, setStatus] = useState<SupportIncidentStatus>("reported");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhase("incident");
    setTitle(incident?.title ?? ""); setDetectionSource(incident?.detection_source ?? "team"); setReportedByName(incident?.reported_by_name ?? ""); setAffectedService(incident?.affected_service ?? "");
    setInitialEvidence(incident?.client_report ?? ""); setSuspectedCause(incident?.reason ?? ""); setImpact(incident?.description ?? ""); setReportedAt(toDateTimeInput(incident?.reported_at) || nowForInput()); setSeverity(incident?.severity ?? "medium"); setRecommendation(incident?.recommendation ?? "");
    setContainment(incident?.containment_actions ?? ""); setInvestigation(incident?.investigation ?? ""); setRootCause(incident?.root_cause ?? ""); setResponseAt(toDateTimeInput(incident?.response_at)); setResponseDescription(incident?.response_description ?? ""); setRecoveryValidation(incident?.recovery_validation ?? ""); setStatus(incident?.status ?? "reported"); setResolutionNotes(incident?.resolution_notes ?? ""); setLessonsLearned(incident?.lessons_learned ?? "");
    setAssigneeIds(incident?.assigned_members.map((member) => member.id) ?? []); setError(null);
  }, [incident, open]);

  const severityDetail = SEVERITY_OPTIONS.find((option) => option.value === severity)?.detail;
  const responseReady = useMemo(() => [containment, investigation, rootCause, responseDescription, recoveryValidation, resolutionNotes, lessonsLearned].filter((value) => value.trim()).length, [containment, investigation, rootCause, responseDescription, recoveryValidation, resolutionNotes, lessonsLearned]);
  function openResponse() { if (status === "reported") setStatus("investigating"); setPhase("response"); }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); setError(null);
    if (!title.trim() || !reportedAt || !affectedService.trim() || !initialEvidence.trim() || !impact.trim()) return setError("Complete the incident title, affected service, initial evidence, impact, and detection time.");
    if (!reportedByName.trim()) return setError("Record who or what detected the incident.");
    if (responseAt && responseAt < reportedAt) return setError("Response time cannot be before the incident was detected.");
    if ((status === "resolved" || status === "unresolved") && (!investigation.trim() || !responseAt || !responseDescription.trim() || !resolutionNotes.trim())) return setError("A closed response needs investigation, response time, recovery actions, and resolution notes.");
    const payload: SupportIncidentPayload = { title: title.trim(), detection_source: detectionSource, reported_by_name: reportedByName.trim(), affected_service: affectedService.trim(), client_report: initialEvidence.trim(), reason: suspectedCause.trim() || null, description: impact.trim(), reported_at: reportedAt, severity, recommendation: recommendation.trim() || null, containment_actions: containment.trim() || null, investigation: investigation.trim() || null, root_cause: rootCause.trim() || null, response_at: responseAt || null, response_description: responseDescription.trim() || null, recovery_validation: recoveryValidation.trim() || null, status, resolution_notes: resolutionNotes.trim() || null, lessons_learned: lessonsLearned.trim() || null };
    if (canManage) payload.assigned_member_ids = assigneeIds;
    try { await onSubmit(payload); onOpenChange(false); } catch (submitError) { setError(getApiErrorMessage(submitError)); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0"><DialogHeader className="border-b border-border px-6 pb-4 pt-6"><DialogTitle>{incident ? `Incident INC-${String(incident.id).padStart(4, "0")}` : "Report an incident"}</DialogTitle><p className="text-sm text-fg-muted">Record verified facts first. Investigation and recovery are maintained as a separate response phase.</p></DialogHeader><div className="grid grid-cols-2 border-b border-border bg-raised/40 px-6 py-3"><PhaseButton active={phase === "incident"} icon={Radar} number="1" title="Detection & triage" detail="What happened and who found it" onClick={() => setPhase("incident")} /><PhaseButton active={phase === "response"} disabled={!incident} icon={ShieldCheck} number="2" title="Response & recovery" detail={incident ? "Contain, investigate, recover" : "Available after incident is saved"} onClick={openResponse} /></div><form onSubmit={handleSubmit} className="space-y-5 px-6 pb-6">
    {phase === "incident" ? <IncidentPhase readOnly={readOnly} title={title} setTitle={setTitle} detectionSource={detectionSource} setDetectionSource={(value) => { setDetectionSource(value); setReportedByName(""); }} reportedByName={reportedByName} setReportedByName={setReportedByName} affectedService={affectedService} setAffectedService={setAffectedService} reportedAt={reportedAt} setReportedAt={setReportedAt} severity={severity} setSeverity={setSeverity} severityDetail={severityDetail ?? ""} initialEvidence={initialEvidence} setInitialEvidence={setInitialEvidence} impact={impact} setImpact={setImpact} suspectedCause={suspectedCause} setSuspectedCause={setSuspectedCause} recommendation={recommendation} setRecommendation={setRecommendation} members={team.data ?? []} assigneeIds={assigneeIds} setAssigneeIds={setAssigneeIds} canManage={canManage} /> : <ResponsePhase readOnly={readOnly} status={status === "reported" ? "investigating" : status} setStatus={setStatus} responseAt={responseAt} setResponseAt={setResponseAt} containment={containment} setContainment={setContainment} investigation={investigation} setInvestigation={setInvestigation} rootCause={rootCause} setRootCause={setRootCause} responseDescription={responseDescription} setResponseDescription={setResponseDescription} recoveryValidation={recoveryValidation} setRecoveryValidation={setRecoveryValidation} resolutionNotes={resolutionNotes} setResolutionNotes={setResolutionNotes} lessonsLearned={lessonsLearned} setLessonsLearned={setLessonsLearned} readiness={responseReady} />}
    {error && <p className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{readOnly ? "Close" : "Cancel"}</Button>{incident && phase === "incident" && <Button type="button" variant="outline" onClick={openResponse}>Open response <ArrowRight className="h-4 w-4" /></Button>}{!readOnly && <Button type="submit" disabled={isPending}>{isPending ? <Spinner /> : phase === "response" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{incident ? phase === "response" ? "Save response" : "Save triage" : "Create incident"}</Button>}</DialogFooter>
  </form></DialogContent></Dialog>;
}

type IncidentPhaseProps = { readOnly: boolean; title: string; setTitle: (v:string)=>void; detectionSource: DetectionSource; setDetectionSource:(v:DetectionSource)=>void; reportedByName:string; setReportedByName:(v:string)=>void; affectedService:string; setAffectedService:(v:string)=>void; reportedAt:string; setReportedAt:(v:string)=>void; severity:SupportIncidentSeverity; setSeverity:(v:SupportIncidentSeverity)=>void; severityDetail:string; initialEvidence:string; setInitialEvidence:(v:string)=>void; impact:string; setImpact:(v:string)=>void; suspectedCause:string; setSuspectedCause:(v:string)=>void; recommendation:string; setRecommendation:(v:string)=>void; members:{id:number;name:string;role:string|null}[]; assigneeIds:number[]; setAssigneeIds:(v:number[])=>void; canManage:boolean };
function IncidentPhase(p: IncidentPhaseProps) { return <section className="space-y-5 pt-5"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-danger" /><div><h3 className="font-semibold text-fg">Incident detection and triage</h3><p className="text-xs text-fg-muted">Capture observable facts. Root cause belongs in the response phase.</p></div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Incident title" id="incident-title" span><Input id="incident-title" value={p.title} onChange={(e) => p.setTitle(e.target.value)} placeholder="Short description of the service interruption" disabled={p.readOnly} required /></Field><Field label="Detected by" id="incident-source"><Select id="incident-source" value={p.detectionSource} onChange={(e) => p.setDetectionSource(e.target.value as DetectionSource)} disabled={p.readOnly}>{SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field><Field label={p.detectionSource === "team" ? "Team member" : p.detectionSource === "client" ? "Client / contact" : "Source name"} id="incident-reporter">{p.detectionSource === "team" ? <Select id="incident-reporter" value={p.reportedByName} onChange={(e) => p.setReportedByName(e.target.value)} disabled={p.readOnly} required><option value="">Select employee...</option>{p.members.map((member) => <option key={member.id} value={member.name}>{member.name} — {member.role}</option>)}</Select> : <Input id="incident-reporter" value={p.reportedByName} onChange={(e) => p.setReportedByName(e.target.value)} placeholder={p.detectionSource === "client" ? "Client organization or contact" : "Alert, vendor, or source"} disabled={p.readOnly} required />}</Field><Field label="Affected service / system" id="affected-service"><Input id="affected-service" value={p.affectedService} onChange={(e) => p.setAffectedService(e.target.value)} placeholder="For example: VerifyX API" disabled={p.readOnly} required /></Field><Field label="Time detected" id="incident-time"><Input id="incident-time" type="datetime-local" value={p.reportedAt} onChange={(e) => p.setReportedAt(e.target.value)} disabled={p.readOnly} required /></Field><Field label="Severity" id="incident-severity"><Select id="incident-severity" value={p.severity} onChange={(e) => p.setSeverity(e.target.value as SupportIncidentSeverity)} disabled={p.readOnly}>{SEVERITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select><p className="text-xs text-fg-muted">{p.severityDetail}</p></Field><Field label="Initial report / evidence" id="incident-evidence" span><Textarea id="incident-evidence" rows={3} value={p.initialEvidence} onChange={(e) => p.setInitialEvidence(e.target.value)} placeholder="Symptoms, alert text, ticket reference, logs, or the client’s exact observation." disabled={p.readOnly} required /></Field><Field label="Business and technical impact" id="incident-impact" span><Textarea id="incident-impact" rows={3} value={p.impact} onChange={(e) => p.setImpact(e.target.value)} placeholder="Affected users, unavailable functions, data or security impact, and current condition." disabled={p.readOnly} required /></Field><Field label="Suspected cause (preliminary)" id="incident-cause"><Textarea id="incident-cause" rows={3} value={p.suspectedCause} onChange={(e) => p.setSuspectedCause(e.target.value)} placeholder="Keep this as a hypothesis until investigation confirms root cause." disabled={p.readOnly} /></Field><Field label="Immediate containment recommendation" id="incident-recommendation"><Textarea id="incident-recommendation" rows={3} value={p.recommendation} onChange={(e) => p.setRecommendation(e.target.value)} placeholder="Safe first action to limit further impact." disabled={p.readOnly} /></Field></div><AssigneePicker selectedIds={p.assigneeIds} onChange={p.setAssigneeIds} disabled={p.readOnly || !p.canManage} /></section>; }

type ResponsePhaseProps = { readOnly:boolean; status:SupportIncidentStatus; setStatus:(v:SupportIncidentStatus)=>void; responseAt:string; setResponseAt:(v:string)=>void; containment:string; setContainment:(v:string)=>void; investigation:string; setInvestigation:(v:string)=>void; rootCause:string; setRootCause:(v:string)=>void; responseDescription:string; setResponseDescription:(v:string)=>void; recoveryValidation:string; setRecoveryValidation:(v:string)=>void; resolutionNotes:string; setResolutionNotes:(v:string)=>void; lessonsLearned:string; setLessonsLearned:(v:string)=>void; readiness:number };
function ResponsePhase(p: ResponsePhaseProps) { return <section className="space-y-5 pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><SearchCheck className="h-5 w-5 text-accent" /><div><h3 className="font-semibold text-fg">Response and recovery</h3><p className="text-xs text-fg-muted">Record actions chronologically, validate restoration, then close the incident.</p></div></div><Badge variant={p.readiness === 7 ? "success" : "neutral"}>{p.readiness}/7 sections complete</Badge></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Response status" id="incident-status"><Select id="incident-status" value={p.status} onChange={(e) => p.setStatus(e.target.value as SupportIncidentStatus)} disabled={p.readOnly}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field><Field label="Response started" id="response-time"><Input id="response-time" type="datetime-local" value={p.responseAt} onChange={(e) => p.setResponseAt(e.target.value)} disabled={p.readOnly} /></Field><IncidentField id="containment" label="Containment actions" value={p.containment} onChange={p.setContainment} placeholder="Actions taken to stop expansion and protect service." disabled={p.readOnly} /><IncidentField id="investigation" label="Investigation and evidence" value={p.investigation} onChange={p.setInvestigation} placeholder="Diagnostics, evidence reviewed, timeline, and technical findings." disabled={p.readOnly} /><IncidentField id="root-cause" label="Confirmed root cause" value={p.rootCause} onChange={p.setRootCause} placeholder="Validated technical or process cause; distinguish it from the initial hypothesis." disabled={p.readOnly} /><IncidentField id="response-description" label="Recovery actions" value={p.responseDescription} onChange={p.setResponseDescription} placeholder="Remediation, restoration, communication, and service recovery actions." disabled={p.readOnly} /><IncidentField id="recovery-validation" label="Recovery validation" value={p.recoveryValidation} onChange={p.setRecoveryValidation} placeholder="Checks proving the service is stable and normal operation is restored." disabled={p.readOnly} /><IncidentField id="resolution-notes" label="Resolution decision" value={p.resolutionNotes} onChange={p.setResolutionNotes} placeholder="Why the incident is resolved or why it remains unresolved." disabled={p.readOnly} /><div className="sm:col-span-2"><IncidentField id="lessons-learned" label="Lessons learned and prevention" value={p.lessonsLearned} onChange={p.setLessonsLearned} placeholder="Follow-up actions, owners, control improvements, and recurrence prevention." disabled={p.readOnly} /></div></div></section>; }

function PhaseButton({ active, disabled, icon: Icon, number, title, detail, onClick }: { active: boolean; disabled?: boolean; icon: typeof Radar; number: string; title: string; detail: string; onClick: () => void }) { return <button type="button" disabled={disabled} onClick={onClick} className={`flex items-center gap-3 rounded-lg p-3 text-left transition-colors ${active ? "bg-surface text-accent shadow-sm" : "text-fg-muted hover:bg-surface/70 disabled:cursor-not-allowed disabled:opacity-50"}`}><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? "bg-accent text-accent-fg" : "bg-border/50"}`}><Icon className="h-4 w-4" /></span><span><span className="block text-sm font-semibold">{number}. {title}</span><span className="block text-xs opacity-75">{detail}</span></span></button>; }
function Field({ label, id, span, children }: { label: string; id: string; span?: boolean; children: React.ReactNode }) { return <div className={`flex flex-col gap-1.5 ${span ? "sm:col-span-2" : ""}`}><Label htmlFor={id}>{label}</Label>{children}</div>; }
function IncidentField({ id, label, value, onChange, placeholder, disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string; disabled?: boolean }) { return <Field label={label} id={id}><Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} disabled={disabled} /></Field>; }
