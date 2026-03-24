import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { ServiceCategory, ServiceItem, UpsertServicePayload } from '../models/service.model';

@Injectable({ providedIn: 'root' })
export class ServiceApiService {
  constructor(private readonly http: HttpClient) {}

  listServices$(): Observable<ServiceItem[]> {
    return this.http.get<unknown>(`${API_BASE_URL}/api/services`).pipe(map((raw) => this.mapServiceArray(raw)));
  }

  listByCategory$(category: ServiceCategory): Observable<ServiceItem[]> {
    return this.http
      .get<unknown>(`${API_BASE_URL}/api/services/category/${encodeURIComponent(category)}`)
      .pipe(map((raw) => this.mapServiceArray(raw)));
  }

  createService$(payload: UpsertServicePayload): Observable<ServiceItem> {
    return this.http
      .post<unknown>(`${API_BASE_URL}/api/services`, this.toUpsertBody(payload))
      .pipe(map((raw) => this.mapService(this.toObject(raw))));
  }

  updateService$(id: string, payload: UpsertServicePayload): Observable<ServiceItem> {
    return this.http
      .put<unknown>(`${API_BASE_URL}/api/services/${encodeURIComponent(id)}`, this.toUpsertBody(payload))
      .pipe(map((raw) => this.mapService(this.toObject(raw))));
  }

  setActive$(id: string, active: boolean): Observable<ServiceItem> {
    return this.http
      .put<unknown>(`${API_BASE_URL}/api/services/${encodeURIComponent(id)}/status`, { active })
      .pipe(map((raw) => this.mapService(this.toObject(raw))));
  }

  deleteService$(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/api/services/${encodeURIComponent(id)}`);
  }

  private mapServiceArray(raw: unknown): ServiceItem[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => this.mapService(item));
  }

  private toUpsertBody(payload: UpsertServicePayload): Record<string, unknown> {
    return {
      name: payload.name.trim(),
      description: payload.description.trim(),
      category: payload.category,
      price: Number(payload.price),
      duration: payload.duration
    };
  }

  private toObject(raw: unknown): Record<string, unknown> {
    return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  }

  private mapService(item: Record<string, unknown>): ServiceItem {
    const categoryRaw = String(item['category'] ?? 'ODONTOLOGIA').toUpperCase();
    const category: ServiceCategory = categoryRaw === 'PSICOLOGIA' ? 'PSICOLOGIA' : 'ODONTOLOGIA';
    return {
      id: String(item['id'] ?? ''),
      name: String(item['name'] ?? 'Servicio'),
      description: String(item['description'] ?? ''),
      category,
      price: Number(item['price'] ?? 0),
      duration: item['duration'] == null ? null : Number(item['duration']),
      active: Boolean(item['active'] ?? true),
      createdAt: String(item['createdAt'] ?? '')
    };
  }
}
