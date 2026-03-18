import { HttpClient } from '@angular/common/http';
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

@Injectable({ providedIn: 'root' })
export class PatientsApiService {
  constructor(private readonly http: HttpClient) {}

  list$(): Observable<PatientVm[]> {
    return this.http.get<unknown>(`${API_BASE_URL}/api/patients`).pipe(
      map((raw) => this.toArray(raw).map((entry) => this.mapPatient(entry)))
    );
  }

  private mapPatient(entry: Record<string, unknown>): PatientVm {
    return {
      id: String(entry['id'] ?? entry['patientId'] ?? crypto.randomUUID()),
      name: String(entry['name'] ?? entry['fullName'] ?? 'Paciente sin nombre'),
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
