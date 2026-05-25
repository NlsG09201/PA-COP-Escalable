import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AuthTokenResponse, MeResponse } from './auth.models';

const ACCESS_TOKEN_KEY = 'cop_access_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiBase = `${API_BASE_URL}/api`;
  private readonly me$ = new BehaviorSubject<MeResponse | null>(null);

  constructor(private readonly http: HttpClient) {}

  current$(): Observable<MeResponse | null> {
    return this.me$.asObservable();
  }

  getAccessToken(): string | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }

  register$(payload: {
    siteId: string;
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    birthDate?: string;
    gender?: 'M' | 'F' | 'O';
  }): Observable<MeResponse> {
    return this.http.post<AuthTokenResponse>(`${this.apiBase}/auth/register`, payload).pipe(
      tap((res) => this.setToken(res.accessToken)),
      switchMap(() => this.loadMe$()),
    );
  }

  login$(payload: { email: string; password: string; siteId?: string }): Observable<MeResponse> {
    const body = {
      username: payload.email.trim(),
      password: payload.password,
      siteId: payload.siteId,
    };
    const doLogin = () =>
      this.http.post<AuthTokenResponse>(`${this.apiBase}/auth/login`, body);

    return doLogin().pipe(
      catchError((err: { status?: number }) => {
        if (err.status !== 401) {
          return throwError(() => err);
        }
        return this.http.post<{ ok?: boolean }>(`${this.apiBase}/auth/ensure-bootstrap`, {}).pipe(
          catchError((bootstrapErr: { status?: number }) => {
            // 403 = admin ya existe y no hace falta reparar; no spamear consola ni reintentar login.
            if (bootstrapErr.status === 403) {
              return of({ ok: false });
            }
            return throwError(() => err);
          }),
          switchMap(() => doLogin()),
          catchError(() => throwError(() => err)),
        );
      }),
      tap((res) => this.setToken(res.accessToken)),
      switchMap(() => this.loadMe$()),
    );
  }

  logout$(): Observable<boolean> {
    return this.http.post<{ ok: boolean }>(`${this.apiBase}/auth/logout`, {}).pipe(
      catchError(() => of({ ok: true })),
      tap(() => this.clearToken()),
      map((res) => !!res.ok),
    );
  }

  loadMe$(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.apiBase}/users/me`).pipe(
      tap((me) => this.me$.next(me)),
      catchError(() => {
        this.me$.next(null);
        return of(null as any);
      }),
    );
  }

  updateMe$(payload: {
    fullName?: string;
    phone?: string;
    email?: string;
    birthDate?: string;
    gender?: 'M' | 'F' | 'O';
    password?: string;
  }): Observable<MeResponse> {
    return this.http.patch<MeResponse>(`${this.apiBase}/users/me`, payload).pipe(
      tap((me) => {
        if (me.accessToken) this.setToken(me.accessToken);
        this.me$.next(me);
      }),
    );
  }

  private setToken(token: string): void {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } catch {
      // ignore
    }
  }

  private clearToken(): void {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(ACCESS_TOKEN_KEY);
    } catch {
      // ignore
    }
    this.me$.next(null);
  }
}

