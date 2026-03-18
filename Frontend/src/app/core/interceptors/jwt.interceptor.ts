import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AuthSessionService } from '../services/auth-session.service';
import { TokenStorageService } from '../services/token-storage.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const sessionService = inject(AuthSessionService);
  const tokenStorage = inject(TokenStorageService);
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
