import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { sanitizeClinicalText } from '../lib/clinical-text.sanitizer';

export type ToothStatus = 'HEALTHY' | 'CARIES' | 'RESTORATION' | 'EXTRACTION' | 'TREATMENT';

export type DamageFinding =
  | 'FRACTURE'
  | 'CAVITY'
  | 'WEAR'
  | 'ABFRACTION'
  | 'ROOT_RESORPTION'
  | 'PULPITIS'
  | 'PERIAPICAL_LESION'
  | 'STAINING'
  | 'OTHER';

export interface ToothHistoryVm {
  at: string;
  status: ToothStatus;
  diagnosis: string;
  treatment: string;
  observations: string;
}

export interface ToothPoseVm {
  rotX: number;
  rotY: number;
  rotZ: number;
  offsetMmX: number;
  offsetMmY: number;
  offsetMmZ: number;
}

export interface SimulationKeyframeVm {
  t: number;
  toothPoses: Record<string, ToothPoseVm>;
}

export interface OrthodonticSimulationVm {
  plannedDurationMonths: number;
  notes: string;
  keyframes: SimulationKeyframeVm[];
}

export interface ToothStateVm {
  tooth: string;
  status: ToothStatus;
  braces: boolean;
  damages: DamageFinding[];
  diagnosis: string;
  treatment: string;
  /** Free-text clinical observations (stored server-side as clinicalObservations). */
  clinicalObservations: string;
  updatedAt: string;
  history: ToothHistoryVm[];
}

type OdontogramRaw = {
  updatedAt?: unknown;
  teeth?: unknown;
  clinicalTeeth?: unknown;
  orthoSimulation?: unknown;
};

const DAMAGE_SET = new Set<string>([
  'FRACTURE',
  'CAVITY',
  'WEAR',
  'ABFRACTION',
  'ROOT_RESORPTION',
  'PULPITIS',
  'PERIAPICAL_LESION',
  'STAINING',
  'OTHER'
]);

@Injectable({ providedIn: 'root' })
export class OdontogramApiService {
  constructor(private readonly http: HttpClient) {}

  getByPatient$(patientId: string): Observable<{ teeth: ToothStateVm[]; simulation: OrthodonticSimulationVm | null }> {
    return this.http.get<unknown>(`${API_BASE_URL}/api/odontogram/${patientId}`).pipe(
      map((raw) => {
        const mapped = this.mapOdontogramPayload(raw);
        return { teeth: mapped.records, simulation: mapped.simulation };
      })
    );
  }

  patchTooth$(patientId: string, payload: ToothStateVm): Observable<ToothStateVm> {
    const tooth = payload.tooth;
    const diagnosis = sanitizeClinicalText(payload.diagnosis);
    const treatment = sanitizeClinicalText(payload.treatment);
    const clinicalObservations = sanitizeClinicalText(payload.clinicalObservations);
    const body = {
      teeth: { [tooth]: payload.status },
      clinicalTooth: {
        tooth,
        status: payload.status,
        braces: payload.braces,
        damages: payload.damages,
        diagnosis,
        treatment,
        clinicalObservations,
        appendHistory: true
      }
    };

    return this.http.patch<unknown>(`${API_BASE_URL}/api/odontogram/${patientId}`, body).pipe(
      map((raw) => this.mapSingleToothFromResponse(raw, tooth, { ...payload, diagnosis, treatment, clinicalObservations }))
    );
  }

  patchSimulation$(patientId: string, simulation: OrthodonticSimulationVm): Observable<OrthodonticSimulationVm | null> {
    const notes = sanitizeClinicalText(simulation.notes);
    const body = {
      simulation: {
        plannedDurationMonths: simulation.plannedDurationMonths,
        notes,
        keyframes: simulation.keyframes.map((k) => ({
          t: k.t,
          toothPoses: k.toothPoses
        }))
      }
    };
    return this.http.patch<unknown>(`${API_BASE_URL}/api/odontogram/${patientId}`, body).pipe(
      map((raw) => this.mapSimulation(this.toObject(raw as object)['orthoSimulation']))
    );
  }

  private mapOdontogramPayload(raw: unknown): { records: ToothStateVm[]; simulation: OrthodonticSimulationVm | null } {
    const obj = this.toObject(raw) as OdontogramRaw;
    const simulation = this.mapSimulation(obj.orthoSimulation);
    const clinical = obj.clinicalTeeth;
    if (clinical && typeof clinical === 'object' && clinical !== null) {
      const entries = Object.entries(clinical as Record<string, unknown>).map(([tooth, v]) =>
        this.mapClinicalEntry(tooth, v, obj.updatedAt)
      );
      return { records: entries, simulation };
    }
    return { records: this.toArray(raw).map((entry) => this.mapState(entry)), simulation };
  }

  private mapSingleToothFromResponse(
    raw: unknown,
    tooth: string,
    fallback: ToothStateVm
  ): ToothStateVm {
    const { records } = this.mapOdontogramPayload(raw);
    const found = records.find((r) => r.tooth === tooth);
    if (found) return found;
    return {
      ...fallback,
      history: fallback.history.length > 0 ? fallback.history : []
    };
  }

  private mapClinicalEntry(tooth: string, raw: unknown, docUpdated: unknown): ToothStateVm {
    const e = this.toObject(raw);
    return {
      tooth,
      status: this.normalizeStatus(e['status'] ?? e['state']),
      braces: Boolean(e['braces']),
      damages: this.normalizeDamages(e['damages']),
      diagnosis: String(e['diagnosis'] ?? ''),
      treatment: String(e['treatment'] ?? ''),
      clinicalObservations: String(e['clinicalObservations'] ?? e['observations'] ?? ''),
      updatedAt: String(e['updatedAt'] ?? docUpdated ?? new Date().toISOString()),
      history: this.mapServerHistory(e['progressHistory'] ?? e['history'])
    };
  }

  private mapServerHistory(raw: unknown): ToothHistoryVm[] {
    return this.toHistory(raw);
  }

  private mapSimulation(raw: unknown): OrthodonticSimulationVm | null {
    if (raw == null || typeof raw !== 'object') return null;
    const o = this.toObject(raw);
    const kfs = Array.isArray(o['keyframes']) ? o['keyframes'] : [];
    const keyframes: SimulationKeyframeVm[] = kfs
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((kf) => {
        const posesRaw = kf['toothPoses'] ?? kf['poses'];
        const poses: Record<string, ToothPoseVm> = {};
        if (posesRaw && typeof posesRaw === 'object') {
          for (const [fdi, pr] of Object.entries(posesRaw as Record<string, unknown>)) {
            const p = this.toObject(pr);
            poses[fdi] = {
              rotX: Number(p['rotX'] ?? 0),
              rotY: Number(p['rotY'] ?? 0),
              rotZ: Number(p['rotZ'] ?? 0),
              offsetMmX: Number(p['offsetMmX'] ?? 0),
              offsetMmY: Number(p['offsetMmY'] ?? 0),
              offsetMmZ: Number(p['offsetMmZ'] ?? 0)
            };
          }
        }
        return { t: Number(kf['t'] ?? 0), toothPoses: poses };
      });
    return {
      plannedDurationMonths: Number(o['plannedDurationMonths'] ?? 18),
      notes: String(o['notes'] ?? ''),
      keyframes
    };
  }

  private mapState(entry: Record<string, unknown>): ToothStateVm {
    return {
      tooth: String(entry['tooth'] ?? entry['toothNumber'] ?? '?'),
      status: this.normalizeStatus(entry['status'] ?? entry['state'] ?? entry['condition']),
      braces: Boolean(entry['braces']),
      damages: this.normalizeDamages(entry['damages']),
      diagnosis: String(entry['diagnosis'] ?? ''),
      treatment: String(entry['treatment'] ?? ''),
      clinicalObservations: String(entry['clinicalObservations'] ?? entry['observations'] ?? entry['notes'] ?? ''),
      updatedAt: String(entry['updatedAt'] ?? new Date().toISOString()),
      history: this.toHistory(entry['history'] ?? entry['progressHistory'])
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

  private normalizeDamages(raw: unknown): DamageFinding[] {
    if (!Array.isArray(raw)) return [];
    const out: DamageFinding[] = [];
    for (const item of raw) {
      const s = String(item ?? '').toUpperCase();
      if (DAMAGE_SET.has(s)) out.push(s as DamageFinding);
    }
    return out;
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
