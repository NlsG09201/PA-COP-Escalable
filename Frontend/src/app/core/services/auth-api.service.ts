import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, retry, timer } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { TokenStorageService } from './token-storage.service';

type SiteVm = { id: string; name: string };

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
        name: String(s['name'] ?? s['siteName'] ?? 'Sede')
      })))
    );
  }

  login$(username: string, password: string, siteId: string): Observable<void> {
    return this.http
      .post<LoginResponse>(`${API_BASE_URL}/api/auth/login`, { username, password, siteId })
      .pipe(
        retry({
          count: 2,
          delay: (error: { status?: number }, retryCount) => {
            const isTransient = error.status === 0 || error.status === 500 || error.status === 502 || error.status === 503;
            if (!isTransient) {
              throw error;
            }
            return timer(800 * retryCount);
          }
        }),
        map((res) => {
          this.tokenStorage.setTokens(res.accessToken, res.refreshToken);
        })
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
