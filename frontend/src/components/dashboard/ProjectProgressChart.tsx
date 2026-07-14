/**
 * dashboard/ProjectProgressChart.tsx
 * Horizontal progress bars per project (Recharts). Delayed projects turn red.
 */
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ProjectTimelineItem } from "@/types";

export function ProjectProgressChart({ data }: { data: ProjectTimelineItem[] }) {
  const rows = data.map((d) => ({ ...d, shortName: d.name.length > 22 ? `${d.name.slice(0, 20)}…` : d.name }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project progress</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState title="No projects yet" />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 44)}>
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
            >
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis
                type="category"
                dataKey="shortName"
                width={130}
                tick={{ fontSize: 12, fill: "hsl(var(--fg-muted))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--raised))" }}
                formatter={(v: number) => [`${v}%`, "Progress"]}
                contentStyle={{
                  background: "hsl(var(--surface))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--fg))",
                }}
              />
              <Bar dataKey="progress_pct" radius={[0, 6, 6, 0]} barSize={18}>
                {rows.map((r) => (
                  <Cell key={r.project_id} fill={r.is_delayed ? "#e11d48" : "hsl(var(--accent))"} />
                ))}
                <LabelList
                  dataKey="progress_pct"
                  position="right"
                  formatter={(v: number) => `${v}%`}
                  style={{ fill: "hsl(var(--fg-muted))", fontSize: 12 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
