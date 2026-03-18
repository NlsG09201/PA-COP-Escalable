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

    // #region agent log
    fetch('http://127.0.0.1:7856/ingest/a97b49cd-5e9b-40bc-bfab-edcab7819c6d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '264b51' },
      body: JSON.stringify({
        sessionId: '264b51',
        runId: 'initial',
        hypothesisId: 'H2',
        location: 'auth-session.service.ts:refresh-start',
        message: 'Refresh flow started',
        data: {
          refreshTokenPresent: !!refreshToken
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion

    return this.http
      .post<RefreshResponse>(`${API_BASE_URL}/api/auth/refresh`, {
        refreshToken
      })
      .pipe(
        map((response) => response.accessToken ?? response.token ?? ''),
        tap((token) => {
          if (!token) {
            throw new Error('Refresh endpoint returned empty token');
          }
          // #region agent log
          fetch('http://127.0.0.1:7856/ingest/a97b49cd-5e9b-40bc-bfab-edcab7819c6d', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '264b51' },
            body: JSON.stringify({
              sessionId: '264b51',
              runId: 'initial',
              hypothesisId: 'H2',
              location: 'auth-session.service.ts:refresh-success',
              message: 'Refresh flow returned a new access token',
              data: {
                tokenSummary: summarizeJwt(token)
              },
              timestamp: Date.now()
            })
          }).catch(() => {});
          // #endregion
          this.tokenStorage.setTokens(token, refreshToken);
        })
      );
  }
}
