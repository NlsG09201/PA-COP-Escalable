"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function PatientsPage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const q = useQuery({ queryKey: ["patients"], queryFn: () => dashboardApi.patients(token) });
  const items = (q.data?.items ?? q.data ?? []) as Array<Record<string, unknown>>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Gestión de pacientes</h1>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {items.map((p, i) => (
          <article key={i} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-sm">
            <p className="font-mono text-xs text-teal-400">{String(p._id ?? p.id)}</p>
            <p className="mt-1 font-medium">{String(p.full_name ?? p.fullName ?? "Paciente")}</p>
            <p className="text-slate-400">{String(p.email ?? p.phone ?? "")}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
