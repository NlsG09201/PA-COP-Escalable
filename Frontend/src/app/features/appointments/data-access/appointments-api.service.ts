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
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 7);
    const to = new Date(now);
    to.setDate(now.getDate() + 30);
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString()
    });
    const url = `${API_BASE_URL}/api/appointments?${params.toString()}`;

    return this.http.get<unknown>(url).pipe(
      map((raw) => this.toArray(raw).map((entry) => this.mapAppointment(entry)))
    );
  }

  private mapAppointment(entry: Record<string, unknown>): AppointmentVm {
    const serviceTitle =
      typeof entry['serviceNameSnapshot'] === 'string' && String(entry['serviceNameSnapshot']).trim()
        ? String(entry['serviceNameSnapshot'])
        : '';
    return {
      title: serviceTitle || String(entry['title'] ?? entry['reason'] ?? 'Cita clinica'),
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
