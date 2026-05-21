"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { wekaLabApi, type TrainConfig, type WekaDataset } from "@/lib/weka-lab-api";

const CLINICAL_LABELS: Record<string, string> = {
  gender: "Género",
  age_group: "Grupo etario",
  sentiment: "Sentimiento",
  wellbeing: "Bienestar",
  anxiety: "Ansiedad (0-1)",
  depression: "Depresión (0-1)",
  stress: "Estrés (0-1)",
  attendance: "Asistencia",
  days_since_last: "Días sin sesión",
  adherence: "Adherencia terapéutica",
  symptoms: "Síntomas",
  prior_relapse: "Recaídas previas",
  emotional_state: "Estado emocional",
  relapse: "Recaída (objetivo)",
  risk_level: "Nivel de riesgo (objetivo)",
};

export function TrainForm({ token }: { token: string }) {
  const qc = useQueryClient();
  const datasetsQ = useQuery({
    queryKey: ["weka-datasets"],
    queryFn: () => wekaLabApi.datasets(token),
  });

  const [file, setFile] = useState<File | null>(null);
  const [datasetId, setDatasetId] = useState("");
  const [targetColumn, setTargetColumn] = useState("");
  const [featureColumns, setFeatureColumns] = useState<string[]>([]);
  const [modelName, setModelName] = useState("");
  const [maxDepth, setMaxDepth] = useState(8);
  const [ccpAlpha, setCcpAlpha] = useState(0);
  const [testSize, setTestSize] = useState(0.2);
  const [cvFolds, setCvFolds] = useState(5);
  const [minSamplesLeaf] = useState(5);

  const selected: WekaDataset | undefined = useMemo(
    () => (datasetsQ.data ?? []).find((d) => d.id === datasetId),
    [datasetsQ.data, datasetId],
  );

  useEffect(() => {
    if (!selected) return;
    setTargetColumn(selected.defaultTarget ?? "");
    setFeatureColumns(selected.defaultFeatures ?? []);
  }, [selected]);

  const uploadM = useMutation({
    mutationFn: () => wekaLabApi.uploadDataset(token, file!, file?.name),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["weka-datasets"] });
      setDatasetId(d.id);
      setFile(null);
    },
  });

  const trainM = useMutation({
    mutationFn: (body: TrainConfig) => wekaLabApi.train(token, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weka-models"] });
      qc.invalidateQueries({ queryKey: ["weka-dashboard"] });
    },
  });

  const toggleFeature = (col: string) => {
    setFeatureColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  const onTrain = () => {
    trainM.mutate({
      datasetId: datasetId || undefined,
      modelName: modelName || undefined,
      targetColumn,
      featureColumns,
      maxDepth,
      ccpAlpha,
      testSize,
      cvFolds,
      minSamplesLeaf,
      setActive: true,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h3 className="text-sm font-semibold text-violet-300">Dataset</h3>
        <label className="block text-xs text-slate-400">Seleccionar dataset</label>
        <select
          className="w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          value={datasetId}
          onChange={(e) => setDatasetId(e.target.value)}
        >
          <option value="">— ARFF clínico por defecto (si existe) —</option>
          {(datasetsQ.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.displayName} ({d.rows} filas)
            </option>
          ))}
        </select>

        <div className="rounded-lg border border-dashed border-cyan-900/60 bg-cyan-950/20 p-4">
          <p className="text-xs text-slate-400">Subir CSV o ARFF (máx. 50MB)</p>
          <input
            type="file"
            accept=".csv,.arff"
            className="mt-2 w-full text-xs text-slate-300"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={!file || uploadM.isPending}
            className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg bg-cyan-800 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
            onClick={() => uploadM.mutate()}
          >
            {uploadM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Cargar dataset
          </button>
          {uploadM.isError && (
            <p className="mt-2 text-xs text-red-400">{String(uploadM.error)}</p>
          )}
        </div>

        {selected && (
          <p className="text-xs text-slate-500">
            {selected.rows} filas · {selected.columns.length} columnas · {selected.format.toUpperCase()}
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h3 className="text-sm font-semibold text-violet-300">Hiperparámetros J48</h3>
        <label className="block text-xs text-slate-400">Nombre del modelo</label>
        <input
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          placeholder="J48-psico-2026"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
        />

        <label className="block text-xs text-slate-400">Columna objetivo (clase)</label>
        <select
          className="w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          value={targetColumn}
          onChange={(e) => setTargetColumn(e.target.value)}
        >
          <option value="">—</option>
          {(selected?.columns ?? []).map((c) => (
            <option key={c} value={c}>
              {CLINICAL_LABELS[c] ?? c}
            </option>
          ))}
        </select>

        <div>
          <p className="text-xs text-slate-400">Variables predictoras</p>
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-800 p-2">
            {(selected?.columns ?? []).filter((c) => c !== targetColumn).map((col) => (
              <label key={col} className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={featureColumns.includes(col)}
                  onChange={() => toggleFeature(col)}
                />
                {CLINICAL_LABELS[col] ?? col}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400">Profundidad máx.</label>
            <input
              type="number"
              min={1}
              max={50}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Pruning (ccp_alpha)</label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
              value={ccpAlpha}
              onChange={(e) => setCcpAlpha(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Test % ({(testSize * 100).toFixed(0)}%)</label>
            <input
              type="range"
              min={10}
              max={50}
              className="mt-2 w-full cursor-pointer"
              value={testSize * 100}
              onChange={(e) => setTestSize(Number(e.target.value) / 100)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">CV folds</label>
            <input
              type="number"
              min={2}
              max={10}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
              value={cvFolds}
              onChange={(e) => setCvFolds(Number(e.target.value))}
            />
          </div>
        </div>

        <button
          type="button"
          disabled={trainM.isPending || featureColumns.length === 0 || !targetColumn}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-cyan-700 px-4 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
          onClick={onTrain}
        >
          {trainM.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Entrenar modelo J48
        </button>
        {trainM.isSuccess && (
          <p className="text-xs text-emerald-400">
            Modelo {(trainM.data as { name?: string }).name} entrenado — F1{" "}
            {(((trainM.data as { metrics?: { f1?: number } }).metrics?.f1 ?? 0) * 100).toFixed(1)}%
          </p>
        )}
        {trainM.isError && <p className="text-xs text-red-400">{String(trainM.error)}</p>}
      </section>
    </div>
  );
}
