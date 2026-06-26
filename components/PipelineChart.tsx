"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { PIPELINE_COLUMNS, STATUS_LABELS } from "@/lib/types";

const COLORS: Record<string, string> = {
  discovered: "#94a3b8",
  shortlisted: "#38bdf8",
  tailored: "#a78bfa",
  applied: "#3366ff",
  interview: "#f59e0b",
  offer: "#34d399",
  rejected: "#f43f5e",
};

export function PipelineChart({ data }: { data: Record<string, number> }) {
  const chartData = PIPELINE_COLUMNS.map((s) => ({
    name: STATUS_LABELS[s],
    key: s,
    value: data[s] || 0,
  }));
  const hasData = chartData.some((d) => d.value > 0);

  if (!hasData) {
    return (
      <div className="grid h-[220px] place-items-center text-sm text-slate-500">
        No pipeline data yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <XAxis
          dataKey="name"
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.05)" }}
          contentStyle={{
            background: "#11182e",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            color: "#fff",
          }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {chartData.map((d) => (
            <Cell key={d.key} fill={COLORS[d.key]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
