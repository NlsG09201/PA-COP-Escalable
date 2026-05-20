"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function J48Page() {
  const token = useAuthStore((s) => s.accessToken)!;
  const treeQ = useQuery({ queryKey: ["j48-tree"], queryFn: () => dashboardApi.j48Tree(token) });

  return (
    <div>
      <h1 className="text-2xl font-bold">Inteligencia artificial — J48</h1>
      <p className="mt-1 text-sm text-slate-400">
        Predicción de recaída psicológica, alertas tempranas y visualización del árbol de decisión.
      </p>
      <pre className="mt-6 max-h-[70vh] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-teal-100/90 whitespace-pre-wrap">
        {String((treeQ.data as { treeText?: string })?.treeText ?? JSON.stringify(treeQ.data, null, 2))}
      </pre>
    </div>
  );
}
