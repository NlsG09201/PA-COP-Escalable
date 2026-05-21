"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Beaker, Brain, GitBranch, LineChart, Stethoscope, Table2 } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { wekaLabApi } from "@/lib/weka-lab-api";
import { TrainForm } from "@/components/weka-lab/train-form";
import { DecisionTreeViz } from "@/components/weka-lab/decision-tree-viz";
import { ValidationPanel } from "@/components/weka-lab/validation-panel";
import { ClinicalPredictForm } from "@/components/weka-lab/clinical-predict-form";
import { ModelHistory } from "@/components/weka-lab/model-history";
import { ModelCompare } from "@/components/weka-lab/model-compare";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TABS = [
  { id: "dashboard", label: "Panel AI", icon: LineChart },
  { id: "train", label: "Entrenar", icon: Beaker },
  { id: "tree", label: "Árbol J48", icon: GitBranch },
  { id: "validate", label: "Validación", icon: Brain },
  { id: "predict", label: "Predicción", icon: Stethoscope },
  { id: "history", label: "Historial", icon: Table2 },
  { id: "compare", label: "Comparar", icon: LineChart },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function WekaAiLabPage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const [tab, setTab] = useState<TabId>("dashboard");
  const [selectedModelId, setSelectedModelId] = useState<string>("");

  const dashQ = useQuery({
    queryKey: ["weka-dashboard"],
    queryFn: () => wekaLabApi.dashboard(token),
  });

  const treeModelId =
    selectedModelId ||
    (dashQ.data?.orgActiveModel?.id as string | undefined) ||
    (dashQ.data?.activeModel?.id as string | undefined) ||
    "";

  const treeQ = useQuery({
    queryKey: ["weka-tree", treeModelId],
    queryFn: () => wekaLabApi.modelTree(token, treeModelId),
    enabled: Boolean(treeModelId),
  });

  const activeMetrics =
    treeQ.data?.metrics ??
    dashQ.data?.activeModel?.metrics ??
    dashQ.data?.orgActiveModel?.metrics;

  const distData = Object.entries(dashQ.data?.classDistribution ?? {}).map(([label, count]) => ({
    label,
    count,
  }));

  return (
    <div className="space-y-8">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-violet-900/40 bg-gradient-to-br from-slate-900 via-violet-950/20 to-cyan-950/30 p-6"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-400/90">
          Laboratorio médico · Machine Learning
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-50">Weka AI Lab</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Entrenamiento, validación y predicción clínica con árboles de decisión J48 (scikit-learn) para
          pacientes psicológicos. Datasets reales, métricas verificables y visualización interactiva del modelo.
        </p>
      </motion.header>

      <nav className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
              tab === id
                ? "bg-violet-900/60 text-violet-100"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
            onClick={() => setTab(id)}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      {tab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Datasets", value: dashQ.data?.orgDatasetsCount ?? dashQ.data?.datasetsCount ?? "—" },
              { label: "Modelos", value: dashQ.data?.orgModelsCount ?? dashQ.data?.modelsCount ?? "—" },
              { label: "Predicciones lab", value: dashQ.data?.orgPredictionsCount ?? "—" },
              {
                label: "F1 modelo activo",
                value: activeMetrics?.f1 != null ? `${(activeMetrics.f1 * 100).toFixed(1)}%` : "—",
              },
            ].map((k) => (
              <div
                key={k.label}
                className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-4"
              >
                <p className="text-xs text-slate-500">{k.label}</p>
                <p className="mt-1 text-2xl font-bold text-violet-200">{k.value}</p>
              </div>
            ))}
          </div>
          {distData.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <h3 className="text-sm font-semibold text-slate-200">Distribución de clases (modelo activo)</h3>
              <div className="mt-4 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distData}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                    <Bar dataKey="count" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <ValidationPanel metrics={activeMetrics} />
        </div>
      )}

      {tab === "train" && <TrainForm token={token} />}

      {tab === "tree" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Seleccione un modelo en Historial o use el activo. Modelo actual:{" "}
            <span className="text-cyan-300">
              {selectedModelId || dashQ.data?.activeModel?.name || "ninguno"}
            </span>
          </p>
          <DecisionTreeViz treeJson={treeQ.data?.treeJson} treeText={treeQ.data?.treeText} />
        </div>
      )}

      {tab === "validate" && <ValidationPanel metrics={activeMetrics} />}

      {tab === "predict" && <ClinicalPredictForm token={token} />}

      {tab === "history" && (
        <ModelHistory
          token={token}
          selectedId={selectedModelId}
          onSelectModel={(id) => {
            setSelectedModelId(id);
            setTab("tree");
          }}
        />
      )}

      {tab === "compare" && <ModelCompare token={token} />}
    </div>
  );
}
