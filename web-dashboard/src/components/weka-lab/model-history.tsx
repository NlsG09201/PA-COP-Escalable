"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Trash2 } from "lucide-react";
import { wekaLabApi, type WekaModel } from "@/lib/weka-lab-api";

export function ModelHistory({
  token,
  onSelectModel,
  selectedId,
}: {
  token: string;
  onSelectModel: (id: string) => void;
  selectedId?: string;
}) {
  const qc = useQueryClient();
  const modelsQ = useQuery({
    queryKey: ["weka-models"],
    queryFn: () => wekaLabApi.models(token),
  });

  const activateM = useMutation({
    mutationFn: (id: string) => wekaLabApi.activateModel(token, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weka-models"] });
      qc.invalidateQueries({ queryKey: ["weka-dashboard"] });
    },
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => wekaLabApi.deleteModel(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weka-models"] }),
  });

  const models = (modelsQ.data ?? []) as WekaModel[];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-900 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Modelo</th>
            <th className="px-4 py-3">F1</th>
            <th className="px-4 py-3">Accuracy</th>
            <th className="px-4 py-3">Entrenado</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {models.map((m) => (
            <tr
              key={m.id}
              className={`border-t border-slate-800 hover:bg-slate-900/80 ${
                selectedId === m.id ? "bg-violet-950/30" : ""
              }`}
            >
              <td className="px-4 py-3">
                <button
                  type="button"
                  className="cursor-pointer font-medium text-slate-200 hover:text-cyan-300"
                  onClick={() => onSelectModel(m.id)}
                >
                  {m.name}
                </button>
                <p className="text-xs text-slate-500">v{m.version}</p>
              </td>
              <td className="px-4 py-3 text-cyan-300">
                {m.metrics?.f1 != null ? `${(m.metrics.f1 * 100).toFixed(1)}%` : "—"}
              </td>
              <td className="px-4 py-3">
                {m.metrics?.accuracy != null ? `${(m.metrics.accuracy * 100).toFixed(1)}%` : "—"}
              </td>
              <td className="px-4 py-3 text-xs text-slate-400">
                {m.trainedAt ? new Date(m.trainedAt).toLocaleString("es-CO") : "—"}
              </td>
              <td className="px-4 py-3">
                {m.isActive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-300">
                    <Check className="h-3 w-3" /> Activo
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">Inactivo</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  {!m.isActive && (
                    <button
                      type="button"
                      disabled={activateM.isPending}
                      className="cursor-pointer rounded border border-violet-700 px-2 py-1 text-xs text-violet-300 hover:bg-violet-950"
                      onClick={() => activateM.mutate(m.id)}
                    >
                      Activar
                    </button>
                  )}
                  {!m.isActive && (
                    <button
                      type="button"
                      disabled={deleteM.isPending}
                      className="cursor-pointer rounded border border-red-900/60 p-1 text-red-400 hover:bg-red-950/50"
                      onClick={() => deleteM.mutate(m.id)}
                      aria-label="Eliminar modelo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {modelsQ.isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      )}
      {!modelsQ.isLoading && models.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-slate-500">Sin modelos entrenados aún.</p>
      )}
    </div>
  );
}
