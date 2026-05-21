import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, retry, switchMap, throwError, timer } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { TokenStorageService } from './token-storage.service';

export type SiteVm = {
  id: string;
  name: string;
  department?: string | null;
  municipality?: string | null;
};

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
};

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  constructor(
    private readonly http: HttpClient,
    private readonly tokenStorage: TokenStorageService
  ) {}

  getSites$(): Observable<SiteVm[]> {
    return this.http.get<unknown>(`${API_BASE_URL}/public/sites`).pipe(
      retry({
        count: 10,
        delay: (error: { status?: number }, retryCount) => {
          const isTransient = error.status === 0 || error.status === 500 || error.status === 502 || error.status === 503;
          if (!isTransient) {
            throw error;
          }
          return timer(Math.min(1000 * retryCount, 4000));
        }
      }),
      map((raw) => this.toArray(raw).map((s) => ({
        id: String(s['id'] ?? ''),
        name: String(s['name'] ?? s['siteName'] ?? 'Sede'),
        department: s['department'] ? String(s['department']) : null,
        municipality: s['municipality'] ? String(s['municipality']) : null,
      })))
    );
  }

  getDepartments$(): Observable<string[]> {
    return this.http.get<{ departments?: string[] }>(`${API_BASE_URL}/public/departments`).pipe(
      retry({
        count: 10,
        delay: (error: { status?: number }, retryCount) => {
          const isTransient = error.status === 0 || error.status === 500 || error.status === 502 || error.status === 503;
          if (!isTransient) throw error;
          return timer(Math.min(1000 * retryCount, 4000));
        },
      }),
      map((raw) => (Array.isArray(raw?.departments) ? raw.departments : []).filter(Boolean)),
    );
  }

  /** Repara admin duplicado o contraseña desincronizada (sin secreto; solo si el API lo permite). */
  ensureBootstrap$(): Observable<{ ok?: boolean }> {
    return this.http.post<{ ok?: boolean }>(`${API_BASE_URL}/api/auth/ensure-bootstrap`, {});
  }

  login$(username: string, password: string, siteId: string): Observable<void> {
    const doLogin = () =>
      this.http.post<LoginResponse>(`${API_BASE_URL}/api/auth/login`, { username, password, siteId });

    return doLogin().pipe(
      retry({
        count: 2,
        delay: (error: { status?: number }, retryCount) => {
          const isTransient = error.status === 0 || error.status === 500 || error.status === 502 || error.status === 503;
          if (!isTransient) {
            throw error;
          }
          return timer(800 * retryCount);
        },
      }),
      catchError((err: { status?: number }) => {
        if (err.status !== 401) {
          return throwError(() => err);
        }
        return this.ensureBootstrap$().pipe(
          switchMap(() => doLogin()),
          catchError(() => throwError(() => err)),
        );
      }),
      map((res) => {
        this.tokenStorage.setTokens(res.accessToken, res.refreshToken);
      }),
    );
  }

  logout(): void {
    this.tokenStorage.clear();
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
