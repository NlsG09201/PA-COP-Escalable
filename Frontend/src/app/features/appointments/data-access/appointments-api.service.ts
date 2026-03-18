import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface AppointmentVm {
  title: string;
  start: string;
}

@Injectable({ providedIn: 'root' })
export class AppointmentsApiService {
  constructor(private readonly http: HttpClient) {}

  list$(): Observable<AppointmentVm[]> {
    return this.http.get<unknown>(`${API_BASE_URL}/api/appointments`).pipe(
      map((raw) => this.toArray(raw).map((entry) => this.mapAppointment(entry)))
    );
  }

  private mapAppointment(entry: Record<string, unknown>): AppointmentVm {
    return {
      title: String(entry['title'] ?? entry['reason'] ?? 'Cita clinica'),
      start: String(entry['start'] ?? entry['startAt'] ?? new Date().toISOString())
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
