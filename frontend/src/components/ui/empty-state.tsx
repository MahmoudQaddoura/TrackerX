/** ui/empty-state.tsx — dashed placeholder with icon, message, optional action. */
import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface/50 px-6 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-raised text-fg-muted">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-medium text-fg">{title}</p>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
