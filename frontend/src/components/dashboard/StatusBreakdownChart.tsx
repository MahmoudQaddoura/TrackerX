import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { STATUS_COLORS, TASK_STATUS_LABELS } from "@/lib/utils";
import type { StatusBreakdownItem, TaskStatus } from "@/types";

export function StatusBreakdownChart({ data }: { data: StatusBreakdownItem[] }) {
  const rows = data
    .filter((item) => item.count > 0)
    .map((item) => ({
      label: TASK_STATUS_LABELS[item.status],
      status: item.status,
      count: item.count,
    }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Work distribution</CardTitle>
          <p className="mt-1 text-xs text-fg-muted">Live task status across the portfolio</p>
        </div>
        <span className="rounded-lg bg-raised px-3 py-1.5 text-sm font-semibold text-fg">{total} tasks</span>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState title="No tasks yet" />
        ) : (
          <div className="grid items-center gap-4 sm:grid-cols-[220px_1fr]">
            <div className="relative h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rows}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={64}
                    outerRadius={92}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {rows.map((row) => (
                      <Cell key={row.status} fill={STATUS_COLORS[row.status as TaskStatus]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value} tasks`, "Count"]}
                    contentStyle={{
                      background: "hsl(var(--surface))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 10,
                      color: "hsl(var(--fg))",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-fg">{total}</span>
                <span className="text-xs text-fg-subtle">total tasks</span>
              </div>
            </div>
            <div className="grid gap-2">
              {rows.map((row) => (
                <div key={row.status} className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm text-fg-muted">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[row.status] }} />
                    {row.label}
                  </span>
                  <span className="font-semibold text-fg">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
