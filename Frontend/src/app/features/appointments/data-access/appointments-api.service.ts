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

    // #region agent log
    fetch('http://127.0.0.1:7856/ingest/a97b49cd-5e9b-40bc-bfab-edcab7819c6d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '264b51' },
      body: JSON.stringify({
        sessionId: '264b51',
        runId: 'initial',
        hypothesisId: 'H3',
        location: 'appointments-api.service.ts:list-start',
        message: 'Appointments request started',
        data: {
          url,
          hasFromParam: url.includes('from='),
          hasToParam: url.includes('to=')
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion

    return this.http.get<unknown>(url).pipe(
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
