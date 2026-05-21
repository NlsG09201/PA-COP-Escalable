"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WekaMetrics } from "@/lib/weka-lab-api";

const RISK_COLORS: Record<string, string> = {
  LOW: "#22d3ee",
  MEDIUM: "#fbbf24",
  HIGH: "#f87171",
};

export function ValidationPanel({ metrics }: { metrics?: WekaMetrics }) {
  if (!metrics) {
    return <p className="text-sm text-slate-500">Entrene un modelo para ver métricas de validación.</p>;
  }

  const cm = metrics.confusionMatrix;
  const cv = metrics.crossValidation;
  const scoreCards = [
    { label: "Accuracy", value: metrics.accuracy, pct: true },
    { label: "Precision", value: metrics.precision, pct: true },
    { label: "Recall", value: metrics.recall, pct: true },
    { label: "F1-score", value: metrics.f1, pct: true },
    { label: "CV F1 (media)", value: cv?.f1Mean ?? 0, pct: true },
  ];

  const cvChart =
    cv?.f1Scores?.map((s, i) => ({ fold: `F${i + 1}`, f1: Math.round(s * 1000) / 10 })) ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {scoreCards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3"
          >
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-bold text-cyan-300">
              {c.pct ? `${(c.value * 100).toFixed(1)}%` : c.value}
            </p>
          </div>
        ))}
      </div>

      {cm?.labels?.length && cm.matrix?.length ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <h3 className="mb-4 text-sm font-semibold text-slate-200">Matriz de confusión</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[280px] border-collapse text-center text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-slate-500">Real \ Pred</th>
                  {cm.labels.map((l) => (
                    <th key={l} className="p-2 text-slate-400">
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cm.matrix.map((row, i) => (
                  <tr key={cm.labels[i]}>
                    <td className="p-2 font-medium text-slate-400">{cm.labels[i]}</td>
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className="p-2"
                        style={{
                          background: `rgba(34, 211, 238, ${Math.min(0.85, cell / (Math.max(...row) || 1))})`,
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {cvChart.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-200">Validación cruzada (F1)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cvChart}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="fold" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #334155" }}
                  formatter={(v) => [`${Number(v ?? 0)}%`, "F1"]}
                />
                <Line type="monotone" dataKey="f1" stroke="#22d3ee" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Media {(cv!.f1Mean * 100).toFixed(2)}% · σ {(cv!.f1Std * 100).toFixed(2)}%
          </p>
        </div>
      )}

      {cm?.labels && (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-200">Distribución por clase (test)</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={cm.labels.map((label, i) => ({
                  label,
                  count: cm.matrix[i]?.reduce((a, b) => a + b, 0) ?? 0,
                }))}
              >
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {cm.labels.map((l) => (
                    <Cell key={l} fill={RISK_COLORS[l] ?? "#64748b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
