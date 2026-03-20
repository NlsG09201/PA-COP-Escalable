import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
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
  const router = inject(Router);
  const token = authService.getToken();

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

      if (error.status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }

      if (!tokenStorage.getRefreshToken()) {
        tokenStorage.clear();
        void router.navigateByUrl('/login');
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
          void router.navigateByUrl('/login');
          return throwError(() => refreshError);
        })
      );
    })
  );
};
