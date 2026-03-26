import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface EmotionPrediction {
  label: string;
  confidence: number;
}

export interface ProsodyFeatures {
  pitchMean: number;
  pitchStd: number;
  energyMean: number;
  energyStd: number;
  speechRate: number;
  pauseRatio: number;
}

export interface EmotionAnalysisResult {
  jobId: string;
  status: string;
  primaryEmotion: string;
  allEmotions: EmotionPrediction[];
  prosody: ProsodyFeatures;
  audioDurationSec: number;
  patientId: string;
  analyzedAt: string;
}

@Injectable({ providedIn: 'root' })
export class EmotionApiService {
  constructor(private readonly http: HttpClient) {}

  analyzeAudio$(patientId: string, file: File): Observable<EmotionAnalysisResult> {
    const formData = new FormData();
    // Backend compatibility endpoint expects multipart field name "audio"
    formData.append('audio', file);
    return this.http.post<EmotionAnalysisResult>(`${API_BASE_URL}/api/emotion/patients/${patientId}/analyze`, formData);
  }

  getResult$(jobId: string): Observable<EmotionAnalysisResult> {
    return this.http.get<EmotionAnalysisResult>(`${API_BASE_URL}/api/emotion/results/${jobId}`);
  }

  getResults$(patientId: string): Observable<EmotionAnalysisResult[]> {
    return this.http.get<EmotionAnalysisResult[]>(`${API_BASE_URL}/api/emotion/patients/${patientId}/results`);
  }
}
