import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { SKIP_GLOBAL_LOADER } from '../http/skip-global-loader.http';

export type ArffFeatureField = {
  key: string;
  label: string;
  type: 'nominal' | 'numeric';
  options?: string[];
  min?: number;
  max?: number;
};

export type ArffDatasetSchema = {
  id: string;
  filename: string;
  displayName: string;
  rows: number;
  target: string;
  classLabels: string[];
  features: ArffFeatureField[];
};

/** Espejo de relapse_risk_j48.arff para UI offline. */
export const DEFAULT_ARFF_SCHEMA: ArffDatasetSchema = {
  id: 'builtin-arff',
  filename: 'relapse_risk_j48.arff',
  displayName: 'Riesgo de recaída (J48 / ARFF COP)',
  rows: 15000,
  target: 'risk_level',
  classLabels: ['LOW', 'MEDIUM', 'HIGH'],
  features: [
    { key: 'gender', label: 'Género', type: 'nominal', options: ['M', 'F', 'O'] },
    { key: 'age_group', label: 'Grupo de edad', type: 'nominal', options: ['YOUNG_ADULT', 'ADULT', 'SENIOR'] },
    { key: 'sentiment', label: 'Sentimiento', type: 'nominal', options: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] },
    { key: 'wellbeing', label: 'Bienestar', type: 'nominal', options: ['HIGH', 'MEDIUM', 'LOW'] },
    { key: 'anxiety', label: 'Ansiedad (0–1)', type: 'numeric', min: 0, max: 1 },
    { key: 'depression', label: 'Depresión (0–1)', type: 'numeric', min: 0, max: 1 },
    { key: 'attendance', label: 'Asistencia', type: 'nominal', options: ['REGULAR', 'IRREGULAR'] },
    { key: 'days_since_last', label: 'Días sin última sesión', type: 'numeric', min: 0, max: 90 },
  ],
};

export type WekaDashboard = {
  orgModelsCount?: number;
  orgDatasetsCount?: number;
  orgPredictionsCount?: number;
  orgActiveModel?: { id: string; name: string; metrics?: { f1?: number; accuracy?: number; note?: string } };
  activeModel?: unknown;
  builtinDataset?: ArffDatasetSchema & { builtin?: boolean; format?: string };
  datasetSchema?: ArffDatasetSchema;
  message?: string;
  j48LabOnline?: boolean;
};

export type WekaModelRow = {
  id: string;
  name: string;
  version?: string;
  metrics?: { accuracy?: number; f1?: number; note?: string };
  isActive?: boolean;
  trainedAt?: string;
};

export type ClinicalPredictPayload = {
  modelId?: string;
  gender?: string;
  age_group?: string;
  sentiment?: string;
  wellbeing?: string;
  anxiety?: number;
  depression?: number;
  attendance?: string;
  days_since_last?: number;
};

export type ClinicalPrediction = {
  modelId: string;
  classLabel: string;
  probabilities: Record<string, number>;
  relapseProbability: number;
  riskLevel: string;
  riskScore: number;
  psychologicalScore: number;
  alertLevel: 'CRITICAL' | 'WARNING' | 'NORMAL';
  recommendations: string[];
  featuresUsed: Record<string, unknown>;
  offline?: boolean;
  datasetId?: string;
};

@Injectable({ providedIn: 'root' })
export class WekaLabApiService {
  constructor(private readonly http: HttpClient) {}

  dashboard$(): Observable<WekaDashboard> {
    return this.http.get<WekaDashboard>(`${API_BASE_URL}/api/weka-lab/dashboard`, SKIP_GLOBAL_LOADER);
  }

  models$(): Observable<WekaModelRow[]> {
    return this.http.get<WekaModelRow[]>(`${API_BASE_URL}/api/weka-lab/models`, SKIP_GLOBAL_LOADER);
  }

  datasets$(): Observable<unknown[]> {
    return this.http.get<unknown[]>(`${API_BASE_URL}/api/weka-lab/datasets`, SKIP_GLOBAL_LOADER);
  }

  datasetSchema$(): Observable<ArffDatasetSchema> {
    return this.http.get<ArffDatasetSchema>(`${API_BASE_URL}/api/weka-lab/dataset-schema`, SKIP_GLOBAL_LOADER);
  }

  predictClinical$(payload: ClinicalPredictPayload): Observable<ClinicalPrediction> {
    return this.http.post<ClinicalPrediction>(`${API_BASE_URL}/api/weka-lab/predict/clinical`, payload);
  }
}
