import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface ClinicalEntryVm {
  date: string;
  note: string;
}

@Injectable({ providedIn: 'root' })
export class ClinicalHistoryApiService {
  constructor(private readonly http: HttpClient) {}

  listByPatient$(patientId: string): Observable<ClinicalEntryVm[]> {
    return this.http.get<unknown>(`${API_BASE_URL}/api/clinical/records/${patientId}`).pipe(
      map((raw) => this.toArray(raw).map((entry) => this.mapEntry(entry)))
    );
  }

  private mapEntry(entry: Record<string, unknown>): ClinicalEntryVm {
    return {
      date: String(entry['date'] ?? entry['createdAt'] ?? '-'),
      note: String(entry['note'] ?? entry['description'] ?? 'Registro clinico')
    };
  }

  private toArray(raw: unknown): Record<string, unknown>[] {
    if (Array.isArray(raw)) {
      return raw.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
    }
    if (typeof raw === 'object' && raw !== null && Array.isArray((raw as { entries?: unknown }).entries)) {
      return (raw as { entries: Record<string, unknown>[] }).entries;
    }
    return [];
  }
}
