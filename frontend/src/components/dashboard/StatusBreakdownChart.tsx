/** dashboard/StatusBreakdownChart.tsx — task counts per status (Recharts bars). */
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { STATUS_COLORS, TASK_STATUS_LABELS } from "@/lib/utils";
import type { StatusBreakdownItem, TaskStatus } from "@/types";

export function StatusBreakdownChart({ data }: { data: StatusBreakdownItem[] }) {
  const rows = data
    .filter((d) => d.count > 0)
    .map((d) => ({ label: TASK_STATUS_LABELS[d.status], status: d.status, count: d.count }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks by status</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState title="No tasks yet" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--fg-muted))" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--fg-muted))" }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "hsl(var(--raised))" }}
                contentStyle={{
                  background: "hsl(var(--surface))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--fg))",
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {rows.map((r) => (
                  <Cell key={r.status} fill={STATUS_COLORS[r.status as TaskStatus]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
