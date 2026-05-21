import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AuthSessionService } from '../services/auth-session.service';
import { TokenStorageService } from '../services/token-storage.service';
import { isAuthOrPublicRequest } from '../http/auth-http.util';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const sessionService = inject(AuthSessionService);
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  if (isAuthOrPublicRequest(req.url)) {
    return next(req);
  }

  const isPublicEndpoint = req.url.startsWith('/public') || req.url.includes('/public/');
  const token = authService.getToken();

  if (!token) {
    if (isPublicEndpoint) return next(req);
    return next(req).pipe(
      catchError((error: { status?: number }) => {
        if (error.status === 401) {
          tokenStorage.clear();
          void router.navigateByUrl('/login');
        }
        return throwError(() => error);
      })
    );
  }

  if (isPublicEndpoint) {
    return next(req);
  }

  const withJwt = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(withJwt).pipe(
    catchError((error: { status?: number }) => {
      if (error.status !== 401) {
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
