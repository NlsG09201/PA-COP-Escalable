"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { medicalAiApi } from "@/lib/medical-ai-api";
import { useAuthStore } from "@/lib/auth-store";
import { ClinicalTimeline } from "@/components/medical-ai/clinical-timeline";
import { AssistantPanel } from "@/components/medical-ai/assistant-panel";

export default function PatientMedicalAiPage() {
  const { id } = useParams<{ id: string }>();
  const token = useAuthStore((s) => s.accessToken)!;
  const qc = useQueryClient();

  const latestQ = useQuery({
    queryKey: ["prediction", id],
    queryFn: () => medicalAiApi.latestPrediction(token, id),
  });
  const timelineQ = useQuery({
    queryKey: ["timeline", id],
    queryFn: () => medicalAiApi.timeline(token, id),
  });
  const recQ = useQuery({
    queryKey: ["recommendations", id],
    queryFn: () => medicalAiApi.recommendations(token, id),
  });

  const assessM = useMutation({
    mutationFn: () => medicalAiApi.assessPatient(token, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prediction", id] });
      qc.invalidateQueries({ queryKey: ["timeline", id] });
      qc.invalidateQueries({ queryKey: ["recommendations", id] });
    },
  });

  const latest = latestQ.data as {
    riskLevel?: string;
    dynamicPsychologicalScore?: number;
    ensembleProbability?: number;
    clinicalRecommendations?: string[];
    scores?: { mentalHealth: number; relapseRisk: number; adherence: number; dropoutRisk: number; urgency: number };
    modelVotes?: Array<{ model: string; relapseProbability: number }>;
  } | null;

  const radarData = latest?.scores
    ? [
        { metric: "Salud mental", value: latest.scores.mentalHealth },
        { metric: "Riesgo recaída", value: latest.scores.relapseRisk },
        { metric: "Adherencia", value: latest.scores.adherence },
        { metric: "Abandono", value: latest.scores.dropoutRisk },
        { metric: "Urgencia", value: latest.scores.urgency },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/medical-ai" className="text-xs text-cyan-500 hover:underline">
            ← Centro IA
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Paciente {id.slice(-8)}</h1>
        </div>
        <button
          type="button"
          onClick={() => assessM.mutate()}
          disabled={assessM.isPending}
          className="cursor-pointer rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-900/40"
        >
          {assessM.isPending ? "Evaluando…" : "Ejecutar ensemble IA"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
              <p className="text-xs text-slate-500">Nivel de riesgo</p>
              <p className="text-2xl font-bold text-amber-300">{latest?.riskLevel ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
              <p className="text-xs text-slate-500">Score psicológico dinámico</p>
              <p className="text-2xl font-bold text-cyan-300">{latest?.dynamicPsychologicalScore ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
              <p className="text-xs text-slate-500">Prob. recaída</p>
              <p className="text-2xl font-bold text-rose-300">
                {latest?.ensembleProbability != null
                  ? `${Math.round(latest.ensembleProbability * 100)}%`
                  : "—"}
              </p>
            </div>
          </div>

          {radarData.length > 0 && (
            <div className="h-72 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <h2 className="mb-2 text-sm text-slate-300">Scoring automático de riesgo</h2>
              <ResponsiveContainer width="100%" height="90%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#475569" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <Radar dataKey="value" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {latest?.modelVotes && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <h2 className="mb-2 text-sm text-slate-300">Votos por modelo (J48 · RF · XGBoost)</h2>
              <ul className="grid gap-2 sm:grid-cols-3 text-sm">
                {latest.modelVotes.map((v) => (
                  <li key={v.model} className="rounded-lg bg-slate-950 px-3 py-2">
                    <span className="text-cyan-400">{v.model}</span>
                    <p className="font-mono">{Math.round(v.relapseProbability * 100)}%</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-300">Timeline clínico inteligente</h2>
            <ClinicalTimeline data={timelineQ.data} />
          </div>
        </div>

        <div className="space-y-6">
          <AssistantPanel token={token} patientId={id} />

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-sm">
            <h2 className="mb-2 font-semibold text-teal-300">Recomendaciones IA</h2>
            <p className="text-slate-400">Frecuencia: {String(recQ.data?.sessionFrequency ?? "—")}</p>
            <ul className="mt-2 list-inside list-disc text-slate-300">
              {((recQ.data?.therapyAdjustments as string[]) ?? []).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">{String(recQ.data?.dentalReview ?? "")}</p>
          </div>

          {latest?.clinicalRecommendations && (
            <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 text-sm">
              <h2 className="mb-2 font-semibold text-amber-200">Acciones clínicas</h2>
              <ul className="list-inside list-disc text-amber-100/90">
                {latest.clinicalRecommendations.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
