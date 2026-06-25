"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const GREEN = "#16a34a";
const RED = "#dc2626";

export function RecettesDepensesChart({ data }: { data: { label: string; recettes: number; depenses: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f6" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" />
        <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" width={56}
          tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
        <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
          formatter={(v: number) => v.toLocaleString("fr-FR")} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="recettes" name="Recettes" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={26} />
        <Bar dataKey="depenses" name="Dépenses" fill={RED} radius={[4, 4, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}
