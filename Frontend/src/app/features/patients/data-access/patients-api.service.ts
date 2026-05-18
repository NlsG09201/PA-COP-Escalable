import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface PatientVm {
  id: string;
  name: string;
  document: string;
  lastVisit: string;
  status: string;
}

const SKIP_GLOBAL_LOADER = { headers: new HttpHeaders({ 'X-Skip-Loader': '1' }) };

@Injectable({ providedIn: 'root' })
export class PatientsApiService {
  constructor(private readonly http: HttpClient) {}

  list$(page = 0, size = 50, search = ''): Observable<{
    items: PatientVm[];
    page: number;
    size: number;
    total: number;
    hasNext: boolean;
  }> {
    const params: Record<string, string> = {
      page: String(page),
      size: String(size),
    };
    if (search.trim()) params['search'] = search.trim();

    return this.http
      .get<{ items?: unknown[]; page?: number; size?: number; total?: number; hasNext?: boolean }>(
        `${API_BASE_URL}/api/patients`,
        { params, ...SKIP_GLOBAL_LOADER },
      )
      .pipe(
        map((raw) => ({
          items: this.toArray(raw?.items ?? raw).map((entry) => this.mapPatient(entry)),
          page: Number(raw?.page ?? page),
          size: Number(raw?.size ?? size),
          total: Number(raw?.total ?? 0),
          hasNext: Boolean(raw?.hasNext),
        })),
      );
  }

  private mapPatient(entry: Record<string, unknown>): PatientVm {
    return {
      id: String(entry['id'] ?? entry['_id'] ?? entry['patientId'] ?? crypto.randomUUID()),
      name: String(entry['name'] ?? entry['fullName'] ?? entry['full_name'] ?? 'Paciente sin nombre'),
      document: String(entry['document'] ?? entry['documentNumber'] ?? '-'),
      lastVisit: String(entry['lastVisit'] ?? entry['updatedAt'] ?? '-'),
      status: String(entry['status'] ?? 'Activo')
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
