"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { dashboardApi, api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function PsychologyPage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const [patientId, setPatientId] = useState("");
  const scalesQ = useQuery({
    queryKey: ["scales"],
    queryFn: () => api<unknown[]>("/api/psychology/scales/templates", token),
  });
  const evoQ = useQuery({
    queryKey: ["evo", patientId],
    queryFn: () => dashboardApi.psychologyEvolution(token, patientId),
    enabled: Boolean(patientId),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Módulo psicológico</h1>
      <label className="block text-sm">
        ID paciente
        <input
          className="mt-1 w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
        />
      </label>
      <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <h2 className="font-medium text-teal-400">Escalas disponibles</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-300">
          {(scalesQ.data ?? []).map((s: unknown) => {
            const row = s as { id?: string; name?: string };
            return (
              <li key={row.id}>
                {row.name} ({row.id})
              </li>
            );
          })}
        </ul>
      </section>
      {patientId && (
        <pre className="overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300">
          {JSON.stringify(evoQ.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
