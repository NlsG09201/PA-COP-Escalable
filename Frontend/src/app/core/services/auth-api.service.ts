import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, retry, switchMap, throwError, timer } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { SKIP_GLOBAL_LOADER } from '../http/skip-global-loader.http';
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

type BootstrapStatus = {
  canAutoRepair?: boolean;
  adminReady?: boolean;
  bootstrapUserExists?: boolean;
  bootstrapPasswordMatchesEnv?: boolean;
};

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  /** Sin interceptores JWT: login/refresh no deben enviar tokens caducados. */
  private readonly bareHttp: HttpClient;

  constructor(
    private readonly http: HttpClient,
    backend: HttpBackend,
    private readonly tokenStorage: TokenStorageService
  ) {
    this.bareHttp = new HttpClient(backend);
  }

  getSites$(): Observable<SiteVm[]> {
    return this.http.get<unknown>(`${API_BASE_URL}/public/sites`, SKIP_GLOBAL_LOADER).pipe(
      retry({
        count: 2,
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
    return this.http.get<{ departments?: string[] }>(`${API_BASE_URL}/public/departments`, SKIP_GLOBAL_LOADER).pipe(
      retry({
        count: 2,
        delay: (error: { status?: number }, retryCount) => {
          const isTransient = error.status === 0 || error.status === 500 || error.status === 502 || error.status === 503;
          if (!isTransient) throw error;
          return timer(Math.min(1000 * retryCount, 4000));
        },
      }),
      map((raw) => (Array.isArray(raw?.departments) ? raw.departments : []).filter(Boolean)),
    );
  }

  getBootstrapStatus$(): Observable<BootstrapStatus> {
    return this.bareHttp.get<BootstrapStatus>(`${API_BASE_URL}/api/auth/bootstrap-status`);
  }

  /** Repara admin en Atlas cuando la contraseña de Render no coincide (sin secreto, solo si canAutoRepair). */
  ensureBootstrap$(): Observable<{ ok?: boolean; message?: string }> {
    return this.bareHttp.post<{ ok?: boolean; message?: string }>(
      `${API_BASE_URL}/api/auth/ensure-bootstrap`,
      {}
    );
  }

  getLoginHelp$(): Observable<{
    loginIds?: string[];
    requireSite?: boolean;
    adminReady?: boolean;
    hint?: string;
  }> {
    return this.bareHttp.get(`${API_BASE_URL}/api/auth/login-help`);
  }

  login$(username: string, password: string, siteId: string): Observable<void> {
    const body = {
      username: username.trim().toLowerCase(),
      password: password.trim(),
      siteId: siteId.trim(),
    };
    const postLogin = () =>
      this.bareHttp.post<LoginResponse>(`${API_BASE_URL}/api/auth/login`, body);

    return postLogin().pipe(
      catchError((err: { status?: number }) => {
        if (err?.status !== 401) {
          return throwError(() => err);
        }
        return this.getBootstrapStatus$().pipe(
          switchMap((status) => {
            if (status.canAutoRepair) {
              return this.ensureBootstrap$().pipe(switchMap(() => postLogin()));
            }
            return postLogin();
          }),
          catchError(() => throwError(() => err)),
        );
      }),
      retry({
        count: 2,
        delay: (error: { status?: number }, retryCount) => {
          const isTransient =
            error.status === 0 || error.status === 500 || error.status === 502 || error.status === 503;
          if (!isTransient) {
            throw error;
          }
          return timer(800 * retryCount);
        },
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
