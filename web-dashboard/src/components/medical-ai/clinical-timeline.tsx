"use client";

import { motion } from "framer-motion";
import type { TimelineResponse } from "@/lib/medical-ai-api";

const domainColor: Record<string, string> = {
  PSYCHOLOGY: "bg-violet-500",
  DENTAL: "bg-sky-500",
  AI: "bg-cyan-400",
  CLINICAL: "bg-emerald-500",
  APPOINTMENT: "bg-slate-500",
};

export function ClinicalTimeline({ data }: { data: TimelineResponse | undefined }) {
  if (!data) return <p className="text-sm text-slate-500">Cargando timeline…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-cyan-900/40 bg-gradient-to-r from-slate-900 to-slate-950 p-4">
        <p className="text-xs text-slate-400">Análisis IA</p>
        <p className="text-sm">
          Tendencia: <span className="font-semibold text-cyan-300">{data.analysis.trend}</span> — {data.analysis.futureRisk}
        </p>
        {data.analysis.correlations.map((c) => (
          <p key={c} className="mt-1 text-xs text-slate-400">
            • {c}
          </p>
        ))}
      </div>
      <ol className="relative border-l border-slate-700 pl-6">
        {data.events.map((e, i) => (
          <motion.li
            key={e.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="mb-6"
          >
            <span
              className={`absolute -left-[7px] mt-1 h-3 w-3 rounded-full ${domainColor[e.domain] ?? domainColor.APPOINTMENT}`}
            />
            <time className="text-xs text-slate-500">{new Date(e.at).toLocaleString()}</time>
            <p className="font-medium text-slate-100">
              {e.title}
              {e.aiDetected && (
                <span className="ml-2 rounded bg-cyan-950 px-1.5 py-0.5 text-[10px] text-cyan-300">IA</span>
              )}
            </p>
            <p className="text-sm text-slate-400">{e.summary}</p>
            {e.riskMarker && <p className="text-xs text-amber-400">Riesgo: {e.riskMarker}</p>}
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
