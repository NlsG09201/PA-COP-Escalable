"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { dashboardApi } from "@/lib/api";
import { medicalAiApi } from "@/lib/medical-ai-api";
import { useAuthStore } from "@/lib/auth-store";
import { useMedicalAiSocket } from "@/hooks/use-medical-ai-socket";
import { AlertPanel } from "@/components/medical-ai/alert-panel";

const HEAT_COLORS = ["#22d3ee", "#fbbf24", "#fb7185", "#f87171"];

export default function MedicalAiHubPage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const qc = useQueryClient();
  const to = new Date().toISOString();
  const from = new Date(Date.now() - 30 * 86400000).toISOString();

  const predictiveQ = useQuery({
    queryKey: ["medical-predictive", from, to],
    queryFn: () => medicalAiApi.predictiveDashboard(token, from, to),
  });
  const alertsQ = useQuery({
    queryKey: ["medical-alerts"],
    queryFn: () => medicalAiApi.alerts(token),
  });
  const priorityQ = useQuery({
    queryKey: ["medical-priority"],
    queryFn: () => medicalAiApi.priorityPatients(token),
  });
  const patientsQ = useQuery({
    queryKey: ["patients-ai"],
    queryFn: () => dashboardApi.patients(token),
  });
  const insightsQ = useQuery({
    queryKey: ["medical-insights"],
    queryFn: () => medicalAiApi.insights(token),
  });

  const liveAlerts = useMedicalAiSocket(token);
  const mergedAlerts = [
    ...liveAlerts,
    ...((alertsQ.data ?? []) as typeof liveAlerts),
  ].filter((a, i, arr) => arr.findIndex((x) => x._id === a._id) === i);

  const ackM = useMutation({
    mutationFn: (id: string) => medicalAiApi.acknowledgeAlert(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medical-alerts"] }),
  });

  const assessM = useMutation({
    mutationFn: (patientId: string) => medicalAiApi.assessPatient(token, patientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medical-priority"] });
      qc.invalidateQueries({ queryKey: ["medical-alerts"] });
      qc.invalidateQueries({ queryKey: ["medical-predictive"] });
    },
  });

  const kpis = predictiveQ.data;
  const patients = (patientsQ.data?.items ?? []) as Array<{ _id?: string; id?: string; full_name?: string }>;

  return (
    <div className="space-y-8">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-cyan-900/50 bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950/30 p-6"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">Medical AI Enterprise</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-50">Centro odontológico y psicológico — IA clínica</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Predicción de recaídas (J48 + Random Forest + XGBoost), alertas en tiempo real, timeline inteligente y
          asistente clínico integrado.
        </p>
      </motion.header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Alertas abiertas", value: kpis?.openAlerts ?? "—" },
          { label: "Pacientes alto riesgo", value: kpis?.highRiskPatientCount ?? "—" },
          { label: "Prob. recaída media", value: kpis ? `${kpis.averageRelapseProbabilityPct}%` : "—" },
          { label: "Ausencias previstas", value: kpis ? `${kpis.predictedNoShowRatePct}%` : "—" },
          { label: "Carga médica est.", value: kpis?.medicalLoadForecast ?? "—" },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-cyan-950/20"
          >
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold text-cyan-100">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <div className="h-64 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <h2 className="mb-2 text-sm font-medium text-slate-300">Tendencia de riesgo (IA)</h2>
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={kpis?.riskTrendSeries ?? []}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="bucket" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip />
                <Area type="monotone" dataKey="avgRisk" stroke="#22d3ee" fill="url(#riskGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="h-56 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <h2 className="mb-2 text-sm font-medium text-slate-300">Heatmap de riesgo</h2>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={kpis?.riskHeatmap ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="riskLevel" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {(kpis?.riskHeatmap ?? []).map((_, i) => (
                    <Cell key={i} fill={HEAT_COLORS[i % HEAT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <h2 className="mb-3 text-sm font-semibold text-cyan-300">Ranking de riesgo — priorizar pacientes</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="pb-2">Paciente</th>
                    <th className="pb-2">Urgencia</th>
                    <th className="pb-2">Nivel</th>
                    <th className="pb-2">Score</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {(priorityQ.data ?? []).map((p) => (
                    <tr key={p.patientId} className="border-t border-slate-800">
                      <td className="py-2 font-mono text-xs">{p.patientId.slice(-8)}</td>
                      <td className="py-2">{p.urgency}</td>
                      <td className="py-2">{p.riskLevel}</td>
                      <td className="py-2">{p.dynamicScore}</td>
                      <td className="py-2 text-right">
                        <Link
                          href={`/medical-ai/patients/${p.patientId}`}
                          className="text-cyan-400 hover:underline"
                        >
                          Ver IA
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <AlertPanel alerts={mergedAlerts} onAcknowledge={(id) => ackM.mutate(id)} />

          <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-300">Evaluar con ensemble IA</h2>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {patients.slice(0, 12).map((p) => {
                const id = String(p._id ?? p.id);
                return (
                  <li key={id} className="flex items-center justify-between gap-2 border-b border-slate-800 py-1">
                    <span className="truncate">{p.full_name ?? id}</span>
                    <button
                      type="button"
                      onClick={() => assessM.mutate(id)}
                      disabled={assessM.isPending}
                      className="shrink-0 cursor-pointer text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      Evaluar
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-300">Insights médicos</h2>
            <ul className="space-y-2 text-xs text-slate-400">
              {(insightsQ.data ?? []).slice(0, 5).map((ins) => (
                <li key={String(ins._id)}>
                  <span className="font-medium text-slate-200">{String(ins.title)}</span>
                  <p>{String(ins.summary)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
