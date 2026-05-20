"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { dashboardApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

const COLORS = ["#14b8a6", "#f59e0b", "#ef4444"];

export default function DashboardPage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const to = new Date().toISOString();
  const from = new Date(Date.now() - 30 * 86400000).toISOString();

  const kpisQ = useQuery({ queryKey: ["kpis", from, to], queryFn: () => dashboardApi.kpis(token, from, to) });
  const trendQ = useQuery({
    queryKey: ["trend", from, to],
    queryFn: () => dashboardApi.appointmentsTrend(token, from, to),
  });
  const j48Q = useQuery({
    queryKey: ["j48-dist"],
    queryFn: () => dashboardApi.j48Distribution(token),
  });

  const kpis = kpisQ.data ?? {};
  const trend = trendQ.data?.series ?? [];
  const j48 = (j48Q.data ?? []) as Array<{ label: string; count: number }>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard administrativo</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Citas", value: String(kpis.totalAppointments ?? "—") },
          { label: "Pacientes activos", value: String(kpis.activePatients ?? "—") },
          { label: "Ingresos COP", value: String(kpis.totalRevenue ?? "—") },
          { label: "Cancelación %", value: String(kpis.cancellationRate ?? "—") },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <p className="text-xs text-slate-400">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-300">Tendencia de citas</h2>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="bucket" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip />
              <Bar dataKey="total" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="h-72 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-300">Distribución riesgo J48</h2>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie data={j48} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label>
                {j48.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
