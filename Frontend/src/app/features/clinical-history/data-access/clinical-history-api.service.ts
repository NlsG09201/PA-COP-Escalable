import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export type ClinicalCategoryVm = 'ODONTOLOGICAL' | 'PSYCHOLOGICAL' | 'UNCLASSIFIED';
export type EditableClinicalCategoryVm = Exclude<ClinicalCategoryVm, 'UNCLASSIFIED'>;

export interface ClinicalEntryVm {
  id: string;
  at: string;
  dateLabel: string;
  type: string;
  category: ClinicalCategoryVm;
  note: string;
}

@Injectable({ providedIn: 'root' })
export class ClinicalHistoryApiService {
  constructor(private readonly http: HttpClient) {}

  listByPatient$(patientId: string): Observable<ClinicalEntryVm[]> {
    return this.http.get<unknown>(`${API_BASE_URL}/api/clinical/records/${patientId}`).pipe(
      map((raw) =>
        this.toArray(raw)
          .map((entry, index) => this.mapEntry(entry, index))
          .sort((left, right) => right.at.localeCompare(left.at))
      )
    );
  }

  addEntry$(
    patientId: string,
    payload: {
      category: EditableClinicalCategoryVm;
      type: string;
      note: string;
    }
  ): Observable<void> {
    return this.http
      .post(`${API_BASE_URL}/api/clinical/records/${patientId}/entries`, {
        type: this.composeType(payload.category, payload.type),
        note: payload.note.trim()
      })
      .pipe(map(() => void 0));
  }

  private mapEntry(entry: Record<string, unknown>, index: number): ClinicalEntryVm {
    const at = String(entry['at'] ?? entry['date'] ?? entry['createdAt'] ?? '');
    const type = String(entry['type'] ?? entry['category'] ?? 'General');

    return {
      id: String(entry['id'] ?? `${at}-${type}-${index}`),
      at,
      dateLabel: this.formatDate(at),
      type,
      category: this.resolveCategory(type),
      note: String(entry['note'] ?? entry['description'] ?? 'Registro clinico')
    };
  }

  private toArray(raw: unknown): Record<string, unknown>[] {
    if (Array.isArray(raw)) {
      return raw.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
    }
    if (typeof raw === 'object' && raw !== null && Array.isArray((raw as { entries?: unknown }).entries)) {
      return (raw as { entries: Record<string, unknown>[] }).entries;
    }
    return [];
  }

  private resolveCategory(type: string): ClinicalCategoryVm {
    const normalized = type.trim().toLowerCase();

    if (
      normalized.includes('psico') ||
      normalized.includes('psych') ||
      normalized.includes('ansiedad') ||
      normalized.includes('depres') ||
      normalized.includes('emoc') ||
      normalized.includes('terapia') ||
      normalized.includes('conduct')
    ) {
      return 'PSYCHOLOGICAL';
    }

    if (
      normalized.includes('odonto') ||
      normalized.includes('dental') ||
      normalized.includes('oral') ||
      normalized.includes('caries') ||
      normalized.includes('periodon') ||
      normalized.includes('endodon') ||
      normalized.includes('rehabil') ||
      normalized.includes('profilaxis') ||
      normalized.includes('oclusion')
    ) {
      return 'ODONTOLOGICAL';
    }

    return 'UNCLASSIFIED';
  }

  private formatDate(value: string): string {
    if (!value) {
      return '-';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(parsed);
  }

  private composeType(category: EditableClinicalCategoryVm, type: string): string {
    const normalizedType = type.trim();
    const categoryLabel = category === 'ODONTOLOGICAL' ? 'Odontologica' : 'Psicologica';

    if (!normalizedType) {
      return categoryLabel;
    }

    return `${categoryLabel}: ${normalizedType}`;
  }
}
