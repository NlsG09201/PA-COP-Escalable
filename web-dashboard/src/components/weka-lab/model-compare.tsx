"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { wekaLabApi } from "@/lib/weka-lab-api";

export function ModelCompare({ token }: { token: string }) {
  const modelsQ = useQuery({ queryKey: ["weka-models"], queryFn: () => wekaLabApi.models(token) });
  const [selected, setSelected] = useState<string[]>([]);

  const compareM = useMutation({
    mutationFn: () => wekaLabApi.compareModels(token, selected),
  });

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 6 ? [...prev, id] : prev,
    );
  };

  const rows = (compareM.data ?? []) as Array<{
    id: string;
    name: string;
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    cvF1Mean?: number;
    maxDepth?: number;
    isActive?: boolean;
  }>;

  const chartData = rows.map((r) => ({
    name: r.name?.slice(0, 12) ?? r.id.slice(0, 8),
    accuracy: Math.round((r.accuracy ?? 0) * 1000) / 10,
    f1: Math.round((r.f1 ?? 0) * 1000) / 10,
    recall: Math.round((r.recall ?? 0) * 1000) / 10,
    cvF1: Math.round((r.cvF1Mean ?? 0) * 1000) / 10,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(modelsQ.data ?? []).map((m) => (
          <button
            key={m.id}
            type="button"
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
              selected.includes(m.id)
                ? "border-cyan-500 bg-cyan-950/50 text-cyan-200"
                : "border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
            onClick={() => toggle(m.id)}
          >
            {m.name}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={selected.length < 2 || compareM.isPending}
        className="cursor-pointer rounded-lg bg-violet-800 px-4 py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
        onClick={() => compareM.mutate()}
      >
        Comparar ({selected.length})
      </button>

      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Modelo</th>
                  <th className="px-3 py-2">Acc</th>
                  <th className="px-3 py-2">F1</th>
                  <th className="px-3 py-2">Recall</th>
                  <th className="px-3 py-2">CV F1</th>
                  <th className="px-3 py-2">Depth</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800">
                    <td className="px-3 py-2">
                      {r.name}
                      {r.isActive && <span className="ml-1 text-emerald-400">★</span>}
                    </td>
                    <td className="px-3 py-2 text-center">{((r.accuracy ?? 0) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-center text-cyan-300">
                      {((r.f1 ?? 0) * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-center">{((r.recall ?? 0) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-center">
                      {r.cvF1Mean != null ? `${(r.cvF1Mean * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">{r.maxDepth ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="h-64 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                <Legend />
                <Bar dataKey="accuracy" fill="#818cf8" name="Accuracy %" />
                <Bar dataKey="f1" fill="#22d3ee" name="F1 %" />
                <Bar dataKey="cvF1" fill="#fbbf24" name="CV F1 %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
