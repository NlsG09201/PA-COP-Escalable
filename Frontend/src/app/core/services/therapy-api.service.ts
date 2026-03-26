import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface TherapyModule {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  durationMin: number;
  contentJson: string;
  active: boolean;
}

export interface TherapySession {
  id: string;
  patientId: string;
  moduleId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  score?: number;
  durationSec?: number;
  responsesJson?: string;
}

export interface TherapyProgress {
  totalSessions: number;
  avgScore: number;
  sessionsByCategory: Record<string, number>;
  streakDays: number;
}

@Injectable({ providedIn: 'root' })
export class TherapyApiService {
  constructor(private readonly http: HttpClient) {}

  getModules$(category?: string): Observable<TherapyModule[]> {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.http.get<TherapyModule[]>(`${API_BASE_URL}/api/therapy/modules${params}`);
  }

  startSession$(patientId: string, moduleId: string): Observable<TherapySession> {
    return this.http.post<TherapySession>(`${API_BASE_URL}/api/therapy/patients/${patientId}/sessions/start`, { moduleId });
  }

  completeExercise$(sessionId: string, responses: Record<string, unknown>): Observable<TherapySession> {
    // Backend expects the responses object directly (Map), not wrapped in { responses }.
    return this.http.post<TherapySession>(`${API_BASE_URL}/api/therapy/sessions/${sessionId}/complete`, responses);
  }

  abandonSession$(sessionId: string): Observable<TherapySession> {
    return this.http.post<TherapySession>(`${API_BASE_URL}/api/therapy/sessions/${sessionId}/abandon`, {});
  }

  getSessions$(patientId: string): Observable<TherapySession[]> {
    return this.http.get<TherapySession[]>(`${API_BASE_URL}/api/therapy/patients/${patientId}/sessions`);
  }

  getProgress$(patientId: string): Observable<TherapyProgress> {
    return this.http.get<TherapyProgress>(`${API_BASE_URL}/api/therapy/patients/${patientId}/progress`);
  }

  getRecommendation$(patientId: string): Observable<TherapyModule[]> {
    // Backend returns a single module from /recommend. Keep frontend contract as array for UI simplicity.
    return this.http.get<TherapyModule>(`${API_BASE_URL}/api/therapy/patients/${patientId}/recommend`).pipe(map((m) => [m]));
  }
}
