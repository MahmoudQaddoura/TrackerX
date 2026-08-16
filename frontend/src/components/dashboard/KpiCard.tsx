import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Accent = "default" | "success" | "warning" | "danger";

const ACCENT: Record<Accent, { text: string; surface: string }> = {
  default: { text: "text-accent", surface: "bg-accent-soft" },
  success: { text: "text-success", surface: "bg-success/10" },
  warning: { text: "text-warning", surface: "bg-warning/10" },
  danger: { text: "text-danger", surface: "bg-danger/10" },
};

export function KpiCard({
  label,
  value,
  description,
  icon: Icon,
  accent = "default",
  to,
}: {
  label: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  accent?: Accent;
  to?: string;
}) {
  const content = (
    <Card
      className={cn(
        "h-full overflow-hidden transition-all",
        to && "group hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-lg",
      )}
    >
      <CardContent className="flex h-full items-start justify-between gap-4 pt-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">{label}</p>
          <p className={cn("mt-2 text-3xl font-bold tracking-tight", ACCENT[accent].text)}>{value}</p>
          {description && <p className="mt-1 text-xs text-fg-muted">{description}</p>}
        </div>
        <div className="flex items-start gap-2">
          {Icon && (
            <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", ACCENT[accent].surface, ACCENT[accent].text)}>
              <Icon className="h-5 w-5" />
            </span>
          )}
          {to && <ArrowUpRight className="h-4 w-4 text-fg-subtle transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />}
        </div>
      </CardContent>
    </Card>
  );

  return to ? (
    <Link to={to} className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {content}
    </Link>
  ) : content;
}
