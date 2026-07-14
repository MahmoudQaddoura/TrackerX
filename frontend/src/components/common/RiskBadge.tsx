/** common/RiskBadge.tsx — badge for computed risk; DelayBadge for delayed flag. */
import { Badge } from "@/components/ui/badge";
import { RISK_LABELS } from "@/lib/utils";
import type { RiskLevel } from "@/types";

const RISK_VARIANT: Record<RiskLevel, "success" | "warning" | "danger" | "neutral"> = {
  on_track: "success",
  at_risk: "warning",
  overdue: "danger",
  unknown: "neutral",
};

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <Badge variant={RISK_VARIANT[risk]}>{RISK_LABELS[risk]}</Badge>;
}

export function DelayBadge({ delayed }: { delayed: boolean }) {
  if (!delayed) return null;
  return <Badge variant="danger">Delayed</Badge>;
}
