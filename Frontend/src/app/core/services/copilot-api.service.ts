import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
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
    return this.http
      .post<any>(`${API_BASE_URL}/api/copilot/patients/${patientId}/start`, { sessionType })
      .pipe(map((raw) => this.toSession(raw)));
  }

  generateSuggestion$(sessionId: string, context: string): Observable<CopilotSuggestion> {
    return this.http
      .post<{ suggestion: string }>(`${API_BASE_URL}/api/copilot/sessions/${sessionId}/suggest`, { context })
      .pipe(
        map((r) => ({
          text: r?.suggestion ?? '',
          timestamp: new Date().toISOString()
        }))
      );
  }

  generateSummary$(sessionId: string): Observable<Pick<CopilotSession, 'summaryText'>> {
    return this.http
      .post<{ summary: string }>(`${API_BASE_URL}/api/copilot/sessions/${sessionId}/summarize`, {})
      .pipe(map((r) => ({ summaryText: r?.summary ?? '' })));
  }

  endSession$(sessionId: string): Observable<CopilotSession> {
    return this.http.post<CopilotSession>(`${API_BASE_URL}/api/copilot/sessions/${sessionId}/end`, {});
  }

  getActiveSessions$(professionalId: string): Observable<CopilotSession[]> {
    return this.http
      .get<any[]>(`${API_BASE_URL}/api/copilot/professionals/${professionalId}/active`)
      .pipe(map((rows) => (rows ?? []).map((r) => this.toSession(r))));
  }

  getHistory$(patientId: string): Observable<CopilotSession[]> {
    return this.http
      .get<any[]>(`${API_BASE_URL}/api/copilot/patients/${patientId}/history`)
      .pipe(map((rows) => (rows ?? []).map((r) => this.toSession(r))));
  }

  private toSession(raw: any): CopilotSession {
    const suggestions = this.parseSuggestions(raw?.suggestionsJson);
    return {
      id: raw?.id,
      patientId: raw?.patientId,
      professionalId: raw?.professionalId,
      sessionType: raw?.sessionType,
      status: raw?.status,
      startedAt: raw?.startedAt,
      endedAt: raw?.endedAt,
      summaryText: raw?.summaryText,
      suggestions
    };
  }

  private parseSuggestions(suggestionsJson: unknown): CopilotSuggestion[] {
    if (typeof suggestionsJson !== 'string' || suggestionsJson.trim() === '') return [];
    try {
      const arr = JSON.parse(suggestionsJson);
      if (!Array.isArray(arr)) return [];
      // We persist entries as JSON fragments; accept either plain strings or objects.
      return arr
        .map((x: any) => {
          if (typeof x === 'string') {
            return { text: x, timestamp: new Date().toISOString() };
          }
          if (x && typeof x === 'object') {
            return {
              text: String(x.text ?? x.suggestion ?? ''),
              timestamp: String(x.timestamp ?? x.ts ?? new Date().toISOString())
            };
          }
          return null;
        })
        .filter((s): s is CopilotSuggestion => s !== null);
    } catch {
      return [];
    }
  }
}
