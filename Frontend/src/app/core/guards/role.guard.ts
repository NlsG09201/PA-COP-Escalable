import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user-role.model';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const acceptedRoles = (route.data?.['roles'] as UserRole[] | undefined) ?? [];

  if (acceptedRoles.length === 0) {
    return true;
  }

  if (authService.hasAnyRole(acceptedRoles)) {
    return true;
  }

  if (authService.hasAnyRole(['PACIENTE', 'PATIENT'])) {
    return router.createUrlTree(['/login'], { queryParams: { error: 'staff-only' } });
  }
  return router.createUrlTree(['/login']);
};
