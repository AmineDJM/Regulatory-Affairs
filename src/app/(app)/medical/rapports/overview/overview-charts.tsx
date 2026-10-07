"use client";

import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { NamedCount } from "@/lib/queries/field-reports";

const BLUE = "#2563eb";
const PALETTE = ["#2563eb", "#0ea5e9", "#14b8a6", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981", "#ec4899"];
const tooltipStyle = { borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" } as const;

/** Tendance mensuelle (aire). */
export function TrendArea({ data }: { data: NamedCount[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="frTrend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BLUE} stopOpacity={0.25} />
            <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" width={44} allowDecimals={false} />
        <Tooltip cursor={{ stroke: "#cbd5e1" }} contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="value" name="Visites" stroke={BLUE} strokeWidth={2} fill="url(#frTrend)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Barres HORIZONTALES (catégorie en ordonnée) — idéal pour médecins / hôpitaux / délégués. */
export function HBars({ data, color = BLUE }: { data: NamedCount[]; color?: string }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée.</p>;
  const height = Math.max(160, data.length * 30 + 20);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 4 }}>
        <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" allowDecimals={false} />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" width={130} />
        <Tooltip cursor={{ fill: "rgba(148,163,184,0.12)" }} contentStyle={tooltipStyle} />
        <Bar dataKey="value" name="Visites" fill={color} radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Répartition par statut (donut). */
export function StatusDonut({ data }: { data: NamedCount[] }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée.</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={54} outerRadius={84} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}
