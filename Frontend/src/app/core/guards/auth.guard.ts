import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { TokenStorageService } from '../services/token-storage.service';
import { isAccessTokenUsable } from '../http/auth-http.util';

export const authGuard: CanActivateFn = () => {
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  const token = tokenStorage.getAccessToken();
  if (isAccessTokenUsable(token)) {
    return true;
  }

  tokenStorage.clear();
  return router.createUrlTree(['/login']);
};
