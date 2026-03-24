import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface CopilotSuggestion {
  text: string;
  timestamp: string;
}

export interface CopilotSession {
  id: string;
  patientId: string;
  professionalId: string;
  sessionType: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  summaryText?: string;
  suggestions: CopilotSuggestion[];
}

@Injectable({ providedIn: 'root' })
export class CopilotApiService {
  constructor(private readonly http: HttpClient) {}

  startSession$(patientId: string, sessionType: string): Observable<CopilotSession> {
    return this.http.post<CopilotSession>(`${API_BASE_URL}/api/copilot/patients/${patientId}/sessions`, { sessionType });
  }

  generateSuggestion$(sessionId: string, context: string): Observable<CopilotSuggestion> {
    return this.http.post<CopilotSuggestion>(`${API_BASE_URL}/api/copilot/sessions/${sessionId}/suggest`, { context });
  }

  generateSummary$(sessionId: string): Observable<CopilotSession> {
    return this.http.post<CopilotSession>(`${API_BASE_URL}/api/copilot/sessions/${sessionId}/summary`, {});
  }

  endSession$(sessionId: string): Observable<CopilotSession> {
    return this.http.post<CopilotSession>(`${API_BASE_URL}/api/copilot/sessions/${sessionId}/end`, {});
  }

  getActiveSessions$(professionalId: string): Observable<CopilotSession[]> {
    return this.http.get<CopilotSession[]>(`${API_BASE_URL}/api/copilot/professionals/${professionalId}/sessions/active`);
  }

  getHistory$(patientId: string): Observable<CopilotSession[]> {
    return this.http.get<CopilotSession[]>(`${API_BASE_URL}/api/copilot/patients/${patientId}/sessions`);
  }
}
