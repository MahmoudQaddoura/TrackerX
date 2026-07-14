/** dashboard/KpiCard.tsx — a single KPI tile with an accent colour + icon. */
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Accent = "default" | "success" | "warning" | "danger";

const ACCENT: Record<Accent, string> = {
  default: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent = "default",
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: Accent;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-5">
        <div>
          <p className="text-sm text-fg-muted">{label}</p>
          <p className={cn("mt-1 text-2xl font-bold", ACCENT[accent])}>{value}</p>
        </div>
        {Icon && <Icon className={cn("h-8 w-8 opacity-70", ACCENT[accent])} />}
      </CardContent>
    </Card>
  );
}
