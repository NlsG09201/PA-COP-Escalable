import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface PsychTestTemplateVm {
  id: string;
  name: string;
  type: string;
}

@Injectable({ providedIn: 'root' })
export class PsychTestsApiService {
  constructor(private readonly http: HttpClient) {}

  templates$(): Observable<PsychTestTemplateVm[]> {
    return this.http.get<unknown>(`${API_BASE_URL}/api/psych-tests/templates`).pipe(
      map((raw) => this.toArray(raw).map((entry) => this.mapTemplate(entry)))
    );
  }

  private mapTemplate(entry: Record<string, unknown>): PsychTestTemplateVm {
    return {
      id: String(entry['id'] ?? crypto.randomUUID()),
      name: String(entry['name'] ?? 'Test Psicologico'),
      type: String(entry['type'] ?? 'General')
    };
  }

  private toArray(raw: unknown): Record<string, unknown>[] {
    if (Array.isArray(raw)) {
      return raw.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
    }
    if (typeof raw === 'object' && raw !== null && Array.isArray((raw as { data?: unknown }).data)) {
      return (raw as { data: Record<string, unknown>[] }).data;
    }
    return [];
  }
}
