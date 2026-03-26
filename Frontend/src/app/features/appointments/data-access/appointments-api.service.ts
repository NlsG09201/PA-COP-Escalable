import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface AppointmentVm {
  title: string;
  start: string;
}

export interface AppointmentPageVm {
  items: AppointmentVm[];
  page: number;
  size: number;
  total: number;
  hasNext: boolean;
}

export type AppointmentStatusVm = 'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

@Injectable({ providedIn: 'root' })
export class AppointmentsApiService {
  constructor(private readonly http: HttpClient) {}

  listPage$(
    page = 0,
    size = 50,
    filters?: { professionalId?: string; status?: AppointmentStatusVm | '' }
  ): Observable<AppointmentPageVm> {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 7);
    const to = new Date(now);
    to.setDate(now.getDate() + 30);
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      page: String(Math.max(0, page)),
      size: String(Math.min(Math.max(1, size), 200))
    });
    if (filters?.professionalId?.trim()) {
      params.set('professionalId', filters.professionalId.trim());
    }
    if (filters?.status) {
      params.set('status', filters.status);
    }
    // Appointments service exposes GET /api/appointments (proxy to legacy),
    // forwarding all query params (from/to/page/size/etc). There is no /page sub-route.
    const url = `${API_BASE_URL}/api/appointments?${params.toString()}`;

    return this.http.get<unknown>(url).pipe(
      map((raw) => this.mapPage(raw))
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

  private mapPage(raw: unknown): AppointmentPageVm {
    if (typeof raw !== 'object' || raw === null) {
      return { items: [], page: 0, size: 50, total: 0, hasNext: false };
    }
    const payload = raw as Record<string, unknown>;
    const itemsRaw = Array.isArray(payload['items']) ? payload['items'] : [];
    const items = itemsRaw
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((entry) => this.mapAppointment(entry));
    return {
      items,
      page: Number(payload['page'] ?? 0),
      size: Number(payload['size'] ?? items.length),
      total: Number(payload['total'] ?? items.length),
      hasNext: Boolean(payload['hasNext'] ?? false)
    };
  }
}
