import { API_BASE } from "./utils";
import { api } from "./api";

export type WekaDataset = {
  id: string;
  filename: string;
  displayName: string;
  format: string;
  rows: number;
  columns: string[];
  defaultTarget: string;
  defaultFeatures: string[];
  columnTypes?: Record<string, string>;
  columnStats?: Record<string, unknown>;
  preview?: Array<Record<string, unknown>>;
  uploadedAt?: string;
};

export type WekaModel = {
  id: string;
  name: string;
  version: string;
  datasetId?: string;
  featureColumns: string[];
  targetColumn?: string;
  hyperparameters?: Record<string, unknown>;
  metrics?: WekaMetrics;
  engine?: string;
  isActive?: boolean;
  trainedAt?: string;
  treeText?: string;
};

export type WekaMetrics = {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  confusionMatrix?: { labels: string[]; matrix: number[][] };
  crossValidation?: { folds: number; f1Scores: number[]; f1Mean: number; f1Std: number };
  report?: Record<string, unknown>;
};

export type TreeNode =
  | {
      type: "leaf";
      id: string;
      samples: number;
      classLabel: string;
      probabilities: Record<string, number>;
    }
  | {
      type: "split";
      id: string;
      feature: string;
      threshold: number;
      samples: number;
      rule: string;
      left: TreeNode;
      right: TreeNode;
    };

export type TreePayload = {
  modelId: string;
  treeText: string;
  treeJson: { root: TreeNode; featureNames: string[]; classLabels: string[]; maxDepth: number; nLeaves: number };
  metrics: WekaMetrics;
  classLabels: string[];
};

export type ClinicalPrediction = {
  modelId: string;
  classLabel: string;
  probabilities: Record<string, number>;
  relapseProbability: number;
  riskLevel: string;
  riskScore: number;
  psychologicalScore: number;
  alertLevel: string;
  recommendations: string[];
  featuresUsed: Record<string, unknown>;
};

export type TrainConfig = {
  datasetId?: string;
  modelName?: string;
  version?: string;
  targetColumn?: string;
  featureColumns?: string[];
  testSize?: number;
  maxDepth?: number;
  minSamplesLeaf?: number;
  minSamplesSplit?: number;
  ccpAlpha?: number;
  cvFolds?: number;
  randomState?: number;
  setActive?: boolean;
};

export type LabDashboard = {
  datasetsCount: number;
  modelsCount: number;
  orgModelsCount?: number;
  orgDatasetsCount?: number;
  orgPredictionsCount?: number;
  activeModel?: WekaModel;
  orgActiveModel?: { id: string; name: string; metrics?: WekaMetrics };
  recentModels?: WekaModel[];
  classDistribution?: Record<string, number>;
  clinicalFeatures?: string[];
};

async function upload<T>(path: string, token: string, file: File, displayName?: string): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const q = displayName ? `?displayName=${encodeURIComponent(displayName)}` : "";
  const res = await fetch(`${API_BASE}${path}${q}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const wekaLabApi = {
  dashboard: (token: string) => api<LabDashboard>("/api/weka-lab/dashboard", token),
  datasets: (token: string) => api<WekaDataset[]>("/api/weka-lab/datasets", token),
  dataset: (token: string, id: string) => api<WekaDataset>(`/api/weka-lab/datasets/${id}`, token),
  uploadDataset: (token: string, file: File, displayName?: string) =>
    upload<WekaDataset>("/api/weka-lab/datasets/upload", token, file, displayName),
  deleteDataset: (token: string, id: string) =>
    api<{ ok: boolean }>(`/api/weka-lab/datasets/${id}`, token, { method: "DELETE" }),
  train: (token: string, body: TrainConfig) =>
    api<WekaModel>("/api/weka-lab/train", token, { method: "POST", body: JSON.stringify(body) }),
  models: (token: string) => api<WekaModel[]>("/api/weka-lab/models", token),
  model: (token: string, id: string) => api<WekaModel>(`/api/weka-lab/models/${id}`, token),
  modelTree: (token: string, id: string) => api<TreePayload>(`/api/weka-lab/models/${id}/tree`, token),
  activateModel: (token: string, id: string) =>
    api<WekaModel>(`/api/weka-lab/models/${id}/activate`, token, { method: "POST" }),
  deleteModel: (token: string, id: string) =>
    api<{ ok: boolean }>(`/api/weka-lab/models/${id}`, token, { method: "DELETE" }),
  compareModels: (token: string, modelIds: string[]) =>
    api<Array<Record<string, unknown>>>("/api/weka-lab/models/compare", token, {
      method: "POST",
      body: JSON.stringify({ modelIds }),
    }),
  predictClinical: (token: string, body: Record<string, unknown>) =>
    api<ClinicalPrediction>("/api/weka-lab/predict/clinical", token, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  predictionHistory: (token: string, limit = 50) =>
    api<Array<Record<string, unknown>>>(`/api/weka-lab/predictions/history?limit=${limit}`, token),
};
