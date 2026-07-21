import { Github, PencilLine } from "lucide-react";
import { type FormEvent, type MouseEvent, useState } from "react";

import type { ProjectPayload } from "@/api/projects";
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
import type { Project } from "@/types";

export function ProjectGitHubButton({
  project,
  isAdmin,
  onSave,
}: {
  project: Project;
  isAdmin: boolean;
  onSave: (payload: ProjectPayload) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState(project.github_repo_url ?? "");

  function handleClick(e?: MouseEvent<HTMLButtonElement>) {
    e?.stopPropagation();

    if (project.github_repo_url) {
      window.open(project.github_repo_url, "_blank", "noopener,noreferrer");
    }

    if (isAdmin) {
      setRepoUrl(project.github_repo_url ?? "");
      setOpen(true);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();

    await onSave({
      name: project.name,
      description: project.description ?? null,
      status: project.status,
      start_date: project.start_date,
      end_date: project.end_date,
      github_repo_url: repoUrl.trim() || null,
    });
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={handleClick} className="gap-1.5">
        <Github className="h-3.5 w-3.5" />
        GitHub
      </Button>

      {isAdmin && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Project GitHub repository</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-github-url">Repository URL</Label>
                <Input
                  id="project-github-url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/org/repo"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="gap-1.5">
                  <PencilLine className="h-3.5 w-3.5" />
                  Save link
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
