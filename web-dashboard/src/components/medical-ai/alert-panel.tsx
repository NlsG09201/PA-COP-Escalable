"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { MedicalAlert } from "@/lib/medical-ai-api";

const severityColor: Record<string, string> = {
  CRITICAL: "border-red-500/60 bg-red-950/40",
  HIGH: "border-orange-500/50 bg-orange-950/30",
  MEDIUM: "border-amber-500/40 bg-amber-950/20",
  LOW: "border-teal-500/30 bg-teal-950/20",
};

export function AlertPanel({
  alerts,
  onAcknowledge,
}: {
  alerts: MedicalAlert[];
  onAcknowledge?: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300/90">Alertas inteligentes</h2>
      <AnimatePresence initial={false}>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500">Sin alertas abiertas.</p>
        ) : (
          alerts.map((a) => (
            <motion.article
              key={a._id}
              layout
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className={`rounded-xl border p-4 ${severityColor[a.severity] ?? severityColor.MEDIUM}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-400">{a.patientName}</p>
                  <h3 className="font-semibold text-slate-100">{a.title}</h3>
                </div>
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-mono text-cyan-300">
                  {a.priorityScore}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300">{a.message}</p>
              {a.recommendations?.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-slate-400">
                  {a.recommendations.slice(0, 3).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
              {onAcknowledge && a.status === "OPEN" && (
                <button
                  type="button"
                  onClick={() => onAcknowledge(a._id)}
                  className="mt-3 cursor-pointer rounded-lg border border-slate-600 px-3 py-1 text-xs hover:bg-slate-800"
                >
                  Marcar revisada
                </button>
              )}
            </motion.article>
          ))
        )}
      </AnimatePresence>
    </div>
  );
}
