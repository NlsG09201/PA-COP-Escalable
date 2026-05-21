import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

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
    return this.http.get<WekaDashboard>(`${API_BASE_URL}/api/weka-lab/dashboard`);
  }

  models$(): Observable<WekaModelRow[]> {
    return this.http.get<WekaModelRow[]>(`${API_BASE_URL}/api/weka-lab/models`);
  }

  datasets$(): Observable<unknown[]> {
    return this.http.get<unknown[]>(`${API_BASE_URL}/api/weka-lab/datasets`);
  }

  datasetSchema$(): Observable<ArffDatasetSchema> {
    return this.http.get<ArffDatasetSchema>(`${API_BASE_URL}/api/weka-lab/dataset-schema`);
  }

  predictClinical$(payload: ClinicalPredictPayload): Observable<ClinicalPrediction> {
    return this.http.post<ClinicalPrediction>(`${API_BASE_URL}/api/weka-lab/predict/clinical`, payload);
  }
}
