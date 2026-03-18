import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface ToothStateVm {
  tooth: string;
  state: string;
}

@Injectable({ providedIn: 'root' })
export class OdontogramApiService {
  constructor(private readonly http: HttpClient) {}

  getByPatient$(patientId: string): Observable<ToothStateVm[]> {
    return this.http.get<unknown>(`${API_BASE_URL}/api/odontogram/${patientId}`).pipe(
      map((raw) => this.toArray(raw).map((entry) => this.mapState(entry)))
    );
  }

  private mapState(entry: Record<string, unknown>): ToothStateVm {
    return {
      tooth: String(entry['tooth'] ?? entry['toothNumber'] ?? '?'),
      state: String(entry['state'] ?? entry['condition'] ?? 'Sin registro')
    };
  }

  private toArray(raw: unknown): Record<string, unknown>[] {
    if (Array.isArray(raw)) {
      return raw.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
    }
    if (typeof raw === 'object' && raw !== null && Array.isArray((raw as { teeth?: unknown }).teeth)) {
      return (raw as { teeth: Record<string, unknown>[] }).teeth;
    }
    return [];
  }
}
