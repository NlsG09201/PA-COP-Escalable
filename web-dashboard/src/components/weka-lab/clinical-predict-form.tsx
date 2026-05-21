"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Stethoscope } from "lucide-react";
import { wekaLabApi, type ClinicalPrediction } from "@/lib/weka-lab-api";

export function ClinicalPredictForm({ token }: { token: string }) {
  const modelsQ = useQuery({ queryKey: ["weka-models"], queryFn: () => wekaLabApi.models(token) });
  const [modelId, setModelId] = useState("");
  const [gender, setGender] = useState("FEMALE");
  const [ageGroup, setAgeGroup] = useState("ADULT");
  const [sentiment, setSentiment] = useState("NEUTRAL");
  const [wellbeing, setWellbeing] = useState("MODERATE");
  const [anxiety, setAnxiety] = useState(0.5);
  const [depression, setDepression] = useState(0.4);
  const [stress, setStress] = useState(0.45);
  const [attendance, setAttendance] = useState("REGULAR");
  const [daysSince, setDaysSince] = useState(14);
  const [adherence, setAdherence] = useState("MEDIUM");
  const [symptoms, setSymptoms] = useState("MODERATE");
  const [priorRelapse, setPriorRelapse] = useState("NO");
  const [emotional, setEmotional] = useState("STABLE");

  const predictM = useMutation({
    mutationFn: () =>
      wekaLabApi.predictClinical(token, {
        modelId: modelId || undefined,
        gender,
        age_group: ageGroup,
        sentiment,
        wellbeing,
        anxiety,
        depression,
        stress,
        attendance,
        days_since_last: daysSince,
        adherence,
        symptoms,
        prior_relapse: priorRelapse,
        emotional_state: emotional,
      }),
  });

  const result = predictM.data as ClinicalPrediction | undefined;
  const alertColor =
    result?.alertLevel === "CRITICAL"
      ? "border-red-500/50 bg-red-950/40 text-red-200"
      : result?.alertLevel === "WARNING"
        ? "border-amber-500/50 bg-amber-950/40 text-amber-200"
        : "border-emerald-500/50 bg-emerald-950/40 text-emerald-200";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          predictM.mutate();
        }}
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold text-cyan-300">
          <Stethoscope className="h-4 w-4" />
          Caso clínico de prueba
        </h3>

        <label className="block text-xs text-slate-400">Modelo (opcional)</label>
        <select
          className="w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
        >
          <option value="">Modelo activo</option>
          {(modelsQ.data ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} {m.isActive ? "★" : ""}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Género", value: gender, set: setGender, opts: ["FEMALE", "MALE", "OTHER"] },
            { label: "Edad", value: ageGroup, set: setAgeGroup, opts: ["YOUNG", "ADULT", "SENIOR"] },
            { label: "Sentimiento", value: sentiment, set: setSentiment, opts: ["POSITIVE", "NEUTRAL", "NEGATIVE"] },
            { label: "Bienestar", value: wellbeing, set: setWellbeing, opts: ["LOW", "MODERATE", "HIGH"] },
            { label: "Asistencia", value: attendance, set: setAttendance, opts: ["REGULAR", "IRREGULAR", "ABSENT"] },
            { label: "Adherencia", value: adherence, set: setAdherence, opts: ["LOW", "MEDIUM", "HIGH"] },
            { label: "Síntomas", value: symptoms, set: setSymptoms, opts: ["MILD", "MODERATE", "SEVERE"] },
            { label: "Recaída previa", value: priorRelapse, set: setPriorRelapse, opts: ["NO", "YES"] },
          ].map((f) => (
            <div key={f.label}>
              <label className="text-xs text-slate-500">{f.label}</label>
              <select
                className="mt-1 w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
              >
                {f.opts.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {[
          { label: "Ansiedad", v: anxiety, set: setAnxiety },
          { label: "Depresión", v: depression, set: setDepression },
          { label: "Estrés", v: stress, set: setStress },
        ].map((s) => (
          <div key={s.label}>
            <label className="text-xs text-slate-500">
              {s.label}: {s.v.toFixed(2)}
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              className="w-full cursor-pointer"
              value={s.v}
              onChange={(e) => s.set(Number(e.target.value))}
            />
          </div>
        ))}

        <div>
          <label className="text-xs text-slate-500">Días sin sesión: {daysSince}</label>
          <input
            type="range"
            min={0}
            max={90}
            className="w-full cursor-pointer"
            value={daysSince}
            onChange={(e) => setDaysSince(Number(e.target.value))}
          />
        </div>

        <label className="text-xs text-slate-500">Estado emocional</label>
        <select
          className="w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          value={emotional}
          onChange={(e) => setEmotional(e.target.value)}
        >
          {["STABLE", "VOLATILE", "CRISIS"].map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={predictM.isPending}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-800 py-3 text-sm font-semibold hover:bg-cyan-700 disabled:opacity-50"
        >
          {predictM.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Ejecutar predicción
        </button>
      </form>

      <div className="space-y-4">
        {result ? (
          <>
            <div className={`rounded-2xl border p-5 ${alertColor}`}>
              <p className="text-xs uppercase tracking-wider opacity-80">Clasificación</p>
              <p className="mt-1 text-3xl font-bold">{result.classLabel}</p>
              <p className="mt-2 text-sm">
                Riesgo {(result.riskScore * 100).toFixed(1)}% · Score psicológico{" "}
                {(result.psychologicalScore * 100).toFixed(1)}%
              </p>
              <p className="mt-1 text-sm">
                Prob. recaída: {(Number(result.relapseProbability) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs font-semibold text-slate-400">Probabilidades</p>
              <ul className="mt-2 space-y-1 text-sm">
                {Object.entries(result.probabilities).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span className="text-cyan-300">{(v * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs font-semibold text-slate-400">Recomendaciones clínicas</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-300">
                {result.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">Complete el formulario y ejecute una predicción en tiempo real.</p>
        )}
        {predictM.isError && <p className="text-xs text-red-400">{String(predictM.error)}</p>}
      </div>
    </div>
  );
}
