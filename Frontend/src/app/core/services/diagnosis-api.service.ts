import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface Finding {
  label: string;
  confidence: number;
  description: string;
  boundingBox?: number[];
}

export interface DiagnosisResult {
  id: string;
  patientId: string;
  imageId: string;
  findings: Finding[];
  modelVersion: string;
  processingTimeMs: number;
  status: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class DiagnosisApiService {
  constructor(private readonly http: HttpClient) {}

  analyzeImage$(patientId: string, file: File): Observable<DiagnosisResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<DiagnosisResult>(`${API_BASE_URL}/api/diagnosis/patients/${patientId}/analyze`, formData);
  }

  getResults$(patientId: string): Observable<DiagnosisResult[]> {
    return this.http.get<DiagnosisResult[]>(`${API_BASE_URL}/api/diagnosis/patients/${patientId}/results`);
  }

  getResult$(resultId: string): Observable<DiagnosisResult> {
    return this.http.get<DiagnosisResult>(`${API_BASE_URL}/api/diagnosis/results/${resultId}`);
  }
}
