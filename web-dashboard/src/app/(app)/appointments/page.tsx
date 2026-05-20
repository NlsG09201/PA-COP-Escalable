"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AppointmentsPage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const q = useQuery({ queryKey: ["appointments"], queryFn: () => dashboardApi.appointments(token) });
  const rows = (q.data ?? []) as Array<Record<string, unknown>>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Agenda médica</h1>
      <p className="mt-1 text-sm text-slate-400">Calendario en tiempo real conectado al API Nest.</p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3">Inicio</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Profesional</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-800">
                <td className="px-4 py-3">{String(r.start_at ?? r.startAt ?? "—")}</td>
                <td className="px-4 py-3">{String(r.status ?? "—")}</td>
                <td className="px-4 py-3">{String(r.patient_id ?? r.patientId ?? "—")}</td>
                <td className="px-4 py-3">{String(r.professional_id ?? r.professionalId ?? "Sin asignar")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
