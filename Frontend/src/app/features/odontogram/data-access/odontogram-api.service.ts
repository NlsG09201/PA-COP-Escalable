import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export type ToothStatus = 'HEALTHY' | 'CARIES' | 'RESTORATION' | 'EXTRACTION' | 'TREATMENT';

export interface ToothHistoryVm {
  at: string;
  status: ToothStatus;
  diagnosis: string;
  treatment: string;
  observations: string;
}

export interface ToothStateVm {
  tooth: string;
  status: ToothStatus;
  diagnosis: string;
  treatment: string;
  observations: string;
  updatedAt: string;
  history: ToothHistoryVm[];
}

type OdontogramRaw = {
  updatedAt?: unknown;
  teeth?: unknown;
};

@Injectable({ providedIn: 'root' })
export class OdontogramApiService {
  constructor(private readonly http: HttpClient) {}

  getByPatient$(patientId: string): Observable<ToothStateVm[]> {
    return this.http.get<unknown>(`${API_BASE_URL}/api/odontogram/${patientId}`).pipe(
      map((raw) => this.toArray(raw).map((entry) => this.mapState(entry)))
    );
  }

  patchTooth$(
    patientId: string,
    payload: Omit<ToothStateVm, 'history' | 'updatedAt'> & { history?: ToothHistoryVm[] }
  ): Observable<ToothStateVm> {
    // Backend contrato actual: PatchRequest { teeth: { [toothCode]: status } }
    const tooth = payload.tooth;
    const body = {
      teeth: {
        [tooth]: payload.status
      }
    };

    return this.http.patch<unknown>(`${API_BASE_URL}/api/odontogram/${patientId}`, body).pipe(
      map((raw) => this.mapPatchedTooth(raw, tooth, payload))
    );
  }

  private mapState(entry: Record<string, unknown>): ToothStateVm {
    return {
      tooth: String(entry['tooth'] ?? entry['toothNumber'] ?? '?'),
      status: this.normalizeStatus(entry['status'] ?? entry['state'] ?? entry['condition']),
      diagnosis: String(entry['diagnosis'] ?? ''),
      treatment: String(entry['treatment'] ?? ''),
      observations: String(entry['observations'] ?? entry['notes'] ?? ''),
      updatedAt: String(entry['updatedAt'] ?? new Date().toISOString()),
      history: this.toHistory(entry['history'])
    };
  }

  private mapPatchedTooth(
    raw: unknown,
    tooth: string,
    fallback: Omit<ToothStateVm, 'history' | 'updatedAt'> & { history?: ToothHistoryVm[] }
  ): ToothStateVm {
    const obj = this.toObject(raw) as OdontogramRaw & Record<string, unknown>;
    const teethMap = (obj.teeth && typeof obj.teeth === 'object' ? (obj.teeth as Record<string, unknown>) : {}) ?? {};
    const savedStatus = teethMap[tooth] ?? fallback.status;

    return {
      tooth,
      status: this.normalizeStatus(savedStatus),
      diagnosis: fallback.diagnosis,
      treatment: fallback.treatment,
      observations: fallback.observations,
      updatedAt: String(obj.updatedAt ?? new Date().toISOString()),
      history: fallback.history ?? []
    };
  }

  private toArray(raw: unknown): Record<string, unknown>[] {
    if (Array.isArray(raw)) {
      return raw.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
    }
    if (typeof raw === 'object' && raw !== null) {
      const objectRaw = raw as { teeth?: unknown; entries?: unknown; items?: unknown; updatedAt?: unknown };
      if (Array.isArray(objectRaw.teeth)) {
        return objectRaw.teeth as Record<string, unknown>[];
      }
      if (Array.isArray(objectRaw.entries)) {
        return objectRaw.entries as Record<string, unknown>[];
      }
      if (Array.isArray(objectRaw.items)) {
        return objectRaw.items as Record<string, unknown>[];
      }
      // Backend actual devuelve `teeth` como un mapa: { "11": "HEALTHY", ... }
      // Convertimos eso al formato que el UI espera.
      if (typeof objectRaw.teeth === 'object' && objectRaw.teeth !== null) {
        const teethObj = objectRaw.teeth as Record<string, unknown>;
        return Object.entries(teethObj).map(([tooth, status]) => ({
          tooth,
          status,
          updatedAt: objectRaw.updatedAt
        }));
      }
    }
    return [];
  }

  private toHistory(raw: unknown): ToothHistoryVm[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((entry) => ({
        at: String(entry['at'] ?? entry['updatedAt'] ?? new Date().toISOString()),
        status: this.normalizeStatus(entry['status'] ?? entry['state']),
        diagnosis: String(entry['diagnosis'] ?? ''),
        treatment: String(entry['treatment'] ?? ''),
        observations: String(entry['observations'] ?? entry['notes'] ?? '')
      }));
  }

  private normalizeStatus(raw: unknown): ToothStatus {
    const candidate = String(raw ?? 'HEALTHY').toUpperCase();
    if (candidate === 'CARIES' || candidate === 'RESTORATION' || candidate === 'EXTRACTION' || candidate === 'TREATMENT') {
      return candidate;
    }
    return 'HEALTHY';
  }

  private toObject(raw: unknown): Record<string, unknown> {
    if (typeof raw === 'object' && raw !== null) {
      return raw as Record<string, unknown>;
    }
    return {};
  }
}
