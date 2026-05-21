import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export type WekaDashboard = {
  orgModelsCount?: number;
  orgDatasetsCount?: number;
  orgPredictionsCount?: number;
  orgActiveModel?: { id: string; name: string; metrics?: { f1?: number; accuracy?: number } };
  activeModel?: unknown;
  message?: string;
  j48LabOnline?: boolean;
};

export type WekaModelRow = {
  id: string;
  name: string;
  version?: string;
  metrics?: { accuracy?: number; f1?: number; [key: string]: number | undefined };
  isActive?: boolean;
  trainedAt?: string;
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
}
