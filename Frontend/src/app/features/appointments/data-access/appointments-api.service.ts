import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface AppointmentVm {
  id: string;
  title: string;
  start: string;
  end: string;
  professionalId: string | null;
  status: string;
}

export interface AppointmentPageVm {
  items: AppointmentVm[];
  page: number;
  size: number;
  total: number;
  hasNext: boolean;
}

export type AppointmentStatusVm = 'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface ProfessionalOptionVm {
  id: string;
  name: string;
}

const SKIP_GLOBAL_LOADER = { headers: new HttpHeaders({ 'X-Skip-Loader': '1' }) };

@Injectable({ providedIn: 'root' })
export class AppointmentsApiService {
  constructor(private readonly http: HttpClient) {}

  listProfessionals$(): Observable<ProfessionalOptionVm[]> {
    return this.http.get<unknown>(`${API_BASE_URL}/api/appointments/professionals`, SKIP_GLOBAL_LOADER).pipe(
      map((raw) => {
        if (!Array.isArray(raw)) return [];
        return raw
          .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
          .map((e) => ({ id: String(e['id'] ?? ''), name: String(e['name'] ?? '') }));
      }),
    );
  }

  claimAppointment$(appointmentId: string, professionalId: string): Observable<unknown> {
    return this.http.patch(`${API_BASE_URL}/api/appointments/${encodeURIComponent(appointmentId)}/claim`, {
      professionalId,
    });
  }

  listPage$(
    page = 0,
    size = 50,
    filters?: { professionalId?: string; status?: AppointmentStatusVm | ''; unassignedOnly?: boolean },
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
      size: String(Math.min(Math.max(1, size), 200)),
    });
    if (filters?.professionalId?.trim()) {
      params.set('professionalId', filters.professionalId.trim());
    }
    if (filters?.status) {
      params.set('status', filters.status);
    }
    if (filters?.unassignedOnly) {
      params.set('unassignedOnly', 'true');
    }
    const url = `${API_BASE_URL}/api/appointments?${params.toString()}`;

    return this.http.get<unknown>(url, SKIP_GLOBAL_LOADER).pipe(map((raw) => this.mapPage(raw)));
  }

  private mapAppointment(entry: Record<string, unknown>): AppointmentVm {
    const serviceTitle =
      typeof entry['serviceNameSnapshot'] === 'string' && String(entry['serviceNameSnapshot']).trim()
        ? String(entry['serviceNameSnapshot'])
        : '';
    const startAt = String(entry['startAt'] ?? entry['start'] ?? new Date().toISOString());
    const endAt = String(entry['endAt'] ?? entry['end'] ?? startAt);
    const prof = entry['professionalId'];
    const professionalId = prof == null || prof === '' ? null : String(prof);
    return {
      id: String(entry['id'] ?? ''),
      title: serviceTitle || String(entry['title'] ?? entry['reason'] ?? 'Cita clinica'),
      start: startAt,
      end: endAt,
      professionalId,
      status: String(entry['status'] ?? ''),
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
      hasNext: Boolean(payload['hasNext'] ?? false),
    };
  }
}
