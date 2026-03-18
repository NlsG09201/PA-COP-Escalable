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
        map((response) => response.accessToken ?? response.token ?? ''),
        tap((token) => {
          if (!token) {
            throw new Error('Refresh endpoint returned empty token');
          }
          this.tokenStorage.setTokens(token, refreshToken);
        })
      );
  }
}
