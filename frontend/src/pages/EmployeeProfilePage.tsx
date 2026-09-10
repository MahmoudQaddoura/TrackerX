import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileText,
  FolderKanban,
  IdCard,
  LockKeyhole,
  Mail,
  Pencil,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  deleteEmployeeProfileFile,
  downloadEmployeeProfileFile,
  fetchEmployeeProfileFiles,
  fetchMember,
  fetchMyMemberProfile,
  updateMember,
  uploadEmployeeProfileFiles,
} from "@/api/team";
import { AttendanceConfirmation } from "@/components/attendance/AttendanceConfirmation";
import { EmployeeFilePreviewDialog } from "@/components/employees/EmployeeFilePreviewDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/apiClient";
import { formatBytes, formatDate } from "@/lib/utils";
import type { EmployeeProfileFile, EmploymentType, TeamMember } from "@/types";

const ACCEPTED_FILES = ".pdf,.doc,.docx,.txt,.md,.rtf,.png,.jpg,.jpeg,.webp";
const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contractor: "Contractor",
  intern: "Intern",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function assignmentLabel(source: TeamMember["projects"][number]["assignment_source"]) {
  if (source === "task") return "Task-linked";
  if (source === "admin_and_task") return "Admin + task";
  if (source === "leadership") return "Project manager";
  return "Admin assigned";
}

export function EmployeeProfilePage({ self = false }: { self?: boolean }) {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isClient } = useAuth();
  const parsedMemberId = Number(memberId);
  const profileQuery = useQuery({
    queryKey: ["employee-profile", self ? "me" : parsedMemberId],
    queryFn: () => (self ? fetchMyMemberProfile() : fetchMember(parsedMemberId)),
    enabled: self || Number.isInteger(parsedMemberId),
  });
  const member = profileQuery.data;
  const canViewPrivateFiles = isAdmin || self;
  const canManagePrivateFiles = isAdmin || self;
  const filesQuery = useQuery({
    queryKey: ["employee-profile-files", member?.id],
    queryFn: () => fetchEmployeeProfileFiles(member!.id),
    enabled: Boolean(member && canViewPrivateFiles),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [englishName, setEnglishName] = useState("");
  const [arabicName, setArabicName] = useState("");
  const [role, setRole] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType>("full_time");
  const [weeklyHours, setWeeklyHours] = useState("40");
  const [editError, setEditError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<EmployeeProfileFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateProfile = useMutation({
    mutationFn: () =>
      updateMember(member!.id, {
        name: englishName.trim(),
        name_arabic: arabicName.trim() || null,
        role: role.trim() || null,
        role_description: roleDescription.trim() || null,
        employment_type: employmentType,
        weekly_hours: weeklyHours.trim() ? Number(weeklyHours) : null,
      }),
    onSuccess: (updated) => {
      qc.setQueryData(["employee-profile", self ? "me" : parsedMemberId], updated);
      qc.invalidateQueries({ queryKey: ["team"] });
      setEditOpen(false);
    },
    onError: (error) => setEditError(getApiErrorMessage(error, "Could not update this profile.")),
  });
  const uploadFiles = useMutation({
    mutationFn: () => uploadEmployeeProfileFiles(member!.id, selectedFiles),
    onSuccess: () => {
      setSelectedFiles([]);
      setUploadError(null);
      qc.invalidateQueries({ queryKey: ["employee-profile-files", member?.id] });
      qc.invalidateQueries({ queryKey: ["employee-profile"] });
      qc.invalidateQueries({ queryKey: ["team"] });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (error) => setUploadError(getApiErrorMessage(error, "Could not upload the selected files.")),
  });
  const removeFile = useMutation({
    mutationFn: deleteEmployeeProfileFile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-profile-files", member?.id] });
      qc.invalidateQueries({ queryKey: ["employee-profile"] });
      qc.invalidateQueries({ queryKey: ["team"] });
    },
  });

  function openEdit() {
    if (!member) return;
    setEnglishName(member.name);
    setArabicName(member.name_arabic ?? "");
    setRole(member.role ?? "");
    setRoleDescription(member.role_description ?? "");
    setEmploymentType(member.employment_type);
    setWeeklyHours(member.weekly_hours != null ? String(member.weekly_hours) : "");
    setEditError(null);
    setEditOpen(true);
  }

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    setSelectedFiles((current) => {
      const known = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      return [...current, ...incoming.filter((file) => !known.has(`${file.name}:${file.size}:${file.lastModified}`))].slice(0, 20);
    });
    setUploadError(null);
  }

  if (profileQuery.isLoading) return <div className="flex min-h-[50vh] items-center justify-center"><Spinner /></div>;
  if (profileQuery.isError || !member) {
    return <ErrorState message="This employee profile could not be loaded." onRetry={() => profileQuery.refetch()} />;
  }

  const currentProjects = member.projects.filter((project) => !["completed", "archived"].includes(project.status));
  const completedTasks = member.done_tasks;
  const openTasks = Math.max(0, member.total_tasks - member.done_tasks);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate(self ? "/dashboard" : "/employees")}>
          <ArrowLeft className="h-4 w-4" /> {self ? "Dashboard" : "Employee directory"}
        </Button>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-[#073b5c] via-accent to-[#1d729a] p-6 text-white shadow-lg sm:p-8">
        <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full border-[42px] border-white/5" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 font-display text-2xl font-bold shadow-inner">
              {initials(member.name) || <UserRound className="h-8 w-8" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-white/20 bg-white/10 text-white">Employee profile</Badge>
                <Badge className="border border-white/20 bg-white/10 font-mono text-white">
                  ID {member.employee_number}
                </Badge>
                <Badge className={member.is_active ? "border border-emerald-200/30 bg-emerald-300/20 text-white" : "border border-white/20 bg-white/10 text-white"}>
                  {member.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <h1 className="mt-3 truncate font-display text-3xl font-bold tracking-tight">{member.name}</h1>
              <p className="mt-1 min-h-6 text-lg text-white/85" dir="rtl" lang="ar">
                {member.name_arabic || "Arabic name not added"}
              </p>
              <p className="mt-2 text-sm font-medium text-white/80">{member.role ?? "Role not assigned"}</p>
            </div>
          </div>
          {isAdmin && <Button className="bg-white text-accent hover:bg-white/90" onClick={openEdit}><Pencil className="h-4 w-4" /> Edit profile</Button>}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ProfileMetric icon={BriefcaseBusiness} label="Current projects" value={currentProjects.length} />
        <ProfileMetric icon={FolderKanban} label="Open tasks" value={openTasks} />
        <ProfileMetric icon={CheckCircle2} label="Completed tasks" value={completedTasks} tone="success" />
        <ProfileMetric icon={FileText} label="Profile files" value={member.profile_file_count} />
      </div>

      {self && !isClient && <AttendanceConfirmation />}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
        <div className="space-y-5">
          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><IdCard className="h-5 w-5" /></span>
                <div>
                  <h2 className="font-display text-xl font-bold text-fg">Role profile</h2>
                  <p className="text-sm text-fg-muted">Responsibility and working context inside TrackerX.</p>
                </div>
              </div>
              <div className="mt-5 rounded-xl border border-border bg-raised/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fg-subtle">Current role</p>
                <p className="mt-1 font-semibold text-fg">{member.role ?? "Not assigned"}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-fg-muted">
                  {member.role_description || "No role summary has been added yet. An administrator can document responsibilities, expertise, and scope here."}
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-border p-3">
                  <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-subtle"><IdCard className="h-3.5 w-3.5" /> Employee ID</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-fg">{member.employee_number}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-subtle"><Clock3 className="h-3.5 w-3.5" /> Employment</p>
                  <p className="mt-1 text-sm font-medium text-fg">{EMPLOYMENT_LABELS[member.employment_type]} · {member.weekly_hours != null ? `${member.weekly_hours}h/week` : "Hours not set"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-subtle"><Mail className="h-3.5 w-3.5" /> TrackerX login</p>
                  <p className="mt-1 truncate text-sm font-medium text-fg">{member.login_email ?? "No login created"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-subtle"><ShieldCheck className="h-3.5 w-3.5" /> Access</p>
                  <p className="mt-1 text-sm font-medium capitalize text-fg">{member.login_enabled ? member.account_role === "admin" ? "Administrator · read & write" : member.access_level?.replace("_", " ") : "No active login"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold text-fg">Current projects</h2>
                  <p className="text-sm text-fg-muted">Live workspaces this employee can access and contribute to.</p>
                </div>
                <Badge variant="neutral">{currentProjects.length} active</Badge>
              </div>
              {currentProjects.length ? (
                <div className="mt-5 space-y-3">
                  {currentProjects.map((project) => (
                    <div key={project.id} className="rounded-xl border border-border p-4 transition-colors hover:border-accent/35 hover:bg-accent-soft/30">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link className="font-semibold text-fg hover:text-accent" to={`/projects/${project.id}`}>{project.name}</Link>
                            <Badge variant={project.project_type === "maintenance_support" ? "warning" : "default"} className="text-[10px]">
                              {project.project_type === "maintenance_support" ? "Maintenance & Support" : "Actual Project"}
                            </Badge>
                            {project.leadership_role && <Badge variant="success" className="text-[10px]">Project Manager</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-fg-muted">{assignmentLabel(project.assignment_source)} · {project.done_tasks}/{project.total_tasks} tasks completed</p>
                        </div>
                        <span className="text-lg font-bold text-accent">{project.progress_pct}%</span>
                      </div>
                      <Progress value={project.progress_pct} className="mt-3" />
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild><Link to={`/projects/${project.id}`}>Open workspace</Link></Button>
                        {project.project_type === "actual_project" && (
                          <>
                            <Button variant="ghost" size="sm" asChild><Link to={`/projects/${project.id}?tab=kanban`}>Tasks</Link></Button>
                            <Button variant="ghost" size="sm" asChild><Link to={`/projects/${project.id}?tab=documents`}>Documents</Link></Button>
                            <Button variant="ghost" size="sm" asChild><Link to={`/projects/${project.id}?tab=assets`}>Assets</Link></Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="mt-5"><EmptyState title="No current projects" description="An administrator can assign a project workspace from the employee directory." /></div>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
        {self && member.has_login && <Card className="overflow-hidden border-accent/20">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><LockKeyhole className="h-5 w-5" /></span><div><h2 className="font-display text-xl font-bold text-fg">Account security</h2><p className="text-sm text-fg-muted">Keep your private TrackerX login protected.</p></div></div>
            <div className="mt-4 rounded-xl border border-border bg-raised/35 p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-fg-subtle">Signed in as</p><p className="mt-1 truncate text-sm font-semibold text-fg">{member.login_email}</p><Button className="mt-4 w-full" asChild><Link to="/change-password"><LockKeyhole className="h-4 w-4" /> Change password</Link></Button></div>
          </CardContent>
        </Card>}

        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><FileText className="h-5 w-5" /></span>
              <div>
                <h2 className="font-display text-xl font-bold text-fg">CV &amp; profile files</h2>
                <p className="text-sm text-fg-muted">Private supporting records for this employee.</p>
              </div>
            </div>

            {!canViewPrivateFiles ? (
              <div className="mt-5 rounded-xl border border-dashed border-border bg-raised/30 p-6 text-center">
                <LockKeyhole className="mx-auto h-6 w-6 text-fg-subtle" />
                <p className="mt-2 text-sm font-medium text-fg">Private documents</p>
                <p className="mt-1 text-xs text-fg-muted">CV files are available only to the employee and administrators.</p>
              </div>
            ) : (
              <>
                {canManagePrivateFiles && (
                  <div
                    className={`mt-5 rounded-xl border-2 border-dashed p-4 text-center transition-colors ${dragging ? "border-accent bg-accent-soft" : "border-border bg-raised/25"}`}
                    onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
                    onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
                  >
                    <Upload className="mx-auto h-6 w-6 text-accent" />
                    <p className="mt-2 text-sm font-medium text-fg">Drop CV files here</p>
                    <p className="mt-1 text-xs text-fg-muted">PDF, Word, text, or image · up to 20 files</p>
                    <input ref={fileInputRef} className="hidden" type="file" multiple accept={ACCEPTED_FILES} onChange={(event) => event.target.files && addFiles(event.target.files)} />
                    <Button className="mt-3" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Choose files</Button>
                  </div>
                )}

                {canManagePrivateFiles && selectedFiles.length > 0 && (
                  <div className="mt-3 rounded-xl border border-accent/20 bg-accent-soft/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-fg">{selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} ready</p>
                      <Button size="sm" onClick={() => uploadFiles.mutate()} disabled={uploadFiles.isPending}>{uploadFiles.isPending ? <Spinner /> : <Upload className="h-4 w-4" />} Upload</Button>
                    </div>
                    <div className="mt-2 space-y-1">
                      {selectedFiles.map((file, index) => <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-2 text-xs text-fg-muted"><span className="truncate">{file.name}</span><button className="text-fg-subtle hover:text-danger" onClick={() => setSelectedFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}
                    </div>
                  </div>
                )}
                {uploadError && <p className="mt-3 text-sm text-danger">{uploadError}</p>}

                <div className="mt-5 space-y-2">
                  {filesQuery.isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : filesQuery.isError ? <ErrorState message="Could not load private profile files." onRetry={() => filesQuery.refetch()} /> : (filesQuery.data ?? []).length ? (
                    (filesQuery.data ?? []).map((file) => (
                      <div key={file.id} className="rounded-xl border border-border p-3">
                        <button className="flex w-full items-start gap-3 text-left" onClick={() => setPreviewFile(file)}>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-raised text-accent"><FileText className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-fg">{file.file_name}</span><span className="mt-0.5 block text-xs text-fg-muted">{formatBytes(file.file_size)} · {formatDate(file.created_at)}</span></span>
                        </button>
                        <div className="mt-3 flex gap-1 border-t border-border pt-2">
                          <Button variant="ghost" size="sm" onClick={() => setPreviewFile(file)}><Eye className="h-3.5 w-3.5" /> Preview</Button>
                          <Button variant="ghost" size="sm" onClick={() => downloadEmployeeProfileFile(file)}><Download className="h-3.5 w-3.5" /> Download</Button>
                          {canManagePrivateFiles && <Button className="ml-auto" variant="ghost" size="icon" aria-label={`Delete ${file.file_name}`} onClick={() => { if (confirm(`Delete ${file.file_name}?`)) removeFile.mutate(file.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
                        </div>
                      </div>
                    ))
                  ) : <EmptyState title="No profile files" description="Upload a CV or supporting employee record above." />}
                </div>
              </>
            )}
          </CardContent>
        </Card>
        </div>
      </div>

      {editOpen && (
        <Dialog open onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader><DialogTitle>Edit employee profile</DialogTitle></DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="profile-name-en">Name in English</Label><Input id="profile-name-en" value={englishName} onChange={(event) => setEnglishName(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="profile-name-ar">Name in Arabic</Label><Input id="profile-name-ar" dir="rtl" lang="ar" value={arabicName} onChange={(event) => setArabicName(event.target.value)} placeholder="الاسم باللغة العربية" /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="profile-role">Role</Label><Input id="profile-role" value={role} onChange={(event) => setRole(event.target.value)} placeholder="e.g. Backend Engineer" /></div>
              <div className="space-y-1.5"><Label htmlFor="profile-employment">Employment type</Label><Select id="profile-employment" value={employmentType} onChange={(event) => setEmploymentType(event.target.value as EmploymentType)}><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="contractor">Contractor</option><option value="intern">Intern</option></Select></div>
              <div className="space-y-1.5"><Label htmlFor="profile-hours">Weekly hours</Label><Input id="profile-hours" type="number" min={1} max={80} step={0.5} value={weeklyHours} onChange={(event) => setWeeklyHours(event.target.value)} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="profile-role-description">Role information</Label><Textarea id="profile-role-description" className="min-h-32" value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} placeholder="Summarize responsibilities, expertise, and project scope." /></div>
              {editError && <p className="text-sm text-danger sm:col-span-2">{editError}</p>}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button disabled={!englishName.trim() || updateProfile.isPending} onClick={() => updateProfile.mutate()}>{updateProfile.isPending && <Spinner />} Save profile</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <EmployeeFilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}

function ProfileMetric({ icon: Icon, label, value, tone }: { icon: typeof BriefcaseBusiness; label: string; value: number; tone?: "success" }) {
  return (
    <Card><CardContent className="flex items-center gap-4 p-4"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone === "success" ? "bg-success/10 text-success" : "bg-accent-soft text-accent"}`}><Icon className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-fg-subtle">{label}</p><p className="mt-0.5 font-display text-2xl font-bold text-fg">{value}</p></div></CardContent></Card>
  );
}
