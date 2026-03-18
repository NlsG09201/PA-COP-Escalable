import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AuthSessionService } from '../services/auth-session.service';
import { TokenStorageService } from '../services/token-storage.service';

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

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const sessionService = inject(AuthSessionService);
  const tokenStorage = inject(TokenStorageService);
  const token = authService.getToken();
  const isAppointmentsRequest = req.url.includes('/api/appointments');

  if (isAppointmentsRequest) {
    // #region agent log
    fetch('http://127.0.0.1:7856/ingest/a97b49cd-5e9b-40bc-bfab-edcab7819c6d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '264b51' },
      body: JSON.stringify({
        sessionId: '264b51',
        runId: 'initial',
        hypothesisId: 'H1',
        location: 'jwt.interceptor.ts:appointments-entry',
        message: 'Appointments request entered JWT interceptor',
        data: {
          url: req.url,
          tokenPresent: !!token,
          tokenSummary: summarizeJwt(token)
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
  }

  if (!token) {
    return next(req);
  }

  const withJwt = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(withJwt).pipe(
    catchError((error: { status?: number }) => {
      const isAuthEndpoint = req.url.includes('/api/auth/login') || req.url.includes('/api/auth/refresh');

      if (isAppointmentsRequest) {
        // #region agent log
        fetch('http://127.0.0.1:7856/ingest/a97b49cd-5e9b-40bc-bfab-edcab7819c6d', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '264b51' },
          body: JSON.stringify({
            sessionId: '264b51',
            runId: 'initial',
            hypothesisId: error.status === 401 ? 'H2' : error.status === 500 ? 'H5' : 'H4',
            location: 'jwt.interceptor.ts:appointments-error',
            message: 'Appointments request returned an error',
            data: {
              url: req.url,
              status: error.status ?? null,
              refreshTokenPresent: !!tokenStorage.getRefreshToken(),
              isAuthEndpoint
            },
            timestamp: Date.now()
          })
        }).catch(() => {});
        // #endregion
      }

      if (error.status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }

      if (!tokenStorage.getRefreshToken()) {
        tokenStorage.clear();
        return throwError(() => error);
      }

      return sessionService.refresh$().pipe(
        switchMap((newToken) => {
          const retryReq = req.clone({
            setHeaders: {
              Authorization: `Bearer ${newToken}`
            }
          });
          return next(retryReq);
        }),
        catchError((refreshError) => {
          tokenStorage.clear();
          return throwError(() => refreshError);
        })
      );
    })
  );
};
