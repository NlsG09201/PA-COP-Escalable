import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { TokenStorageService } from './token-storage.service';

type RefreshResponse = {
  accessToken?: string;
  token?: string;
  refreshToken?: string;
};

function summarizeJwt(token: string | null): Record<string, unknown> | null {
  if (!token) {
    return null;
  }

  try {
    const base64Url = token.split('.')[1] ?? '';
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as {
      roles?: unknown;
      role?: unknown;
      site_id?: unknown;
      exp?: unknown;
    };

    return {
      roles: Array.isArray(payload.roles) ? payload.roles : payload.role ? [payload.role] : [],
      siteId: payload.site_id ?? null,
      exp: typeof payload.exp === 'number' ? payload.exp : null
    };
  } catch {
    return { decodeError: true };
  }
}

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly http: HttpClient;

  constructor(
    backend: HttpBackend,
    private readonly tokenStorage: TokenStorageService
  ) {
    this.http = new HttpClient(backend);
  }

  refresh$(): Observable<string> {
    const refreshToken = this.tokenStorage.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    return this.http
      .post<RefreshResponse>(`${API_BASE_URL}/api/auth/refresh`, {
        refreshToken
      })
      .pipe(
        tap((response) => {
          const token = response.accessToken ?? response.token ?? '';
          if (!token) {
            throw new Error('Refresh endpoint returned empty token');
          }
          this.tokenStorage.setTokens(token, response.refreshToken ?? refreshToken);
        }),
        map((response) => response.accessToken ?? response.token ?? '')
      );
  }
}
