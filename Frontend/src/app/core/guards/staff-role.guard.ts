import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

const STAFF_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL']);

/** Bloquea pacientes (solo PACIENTE) del panel clínico /app. */
export const staffRoleGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = auth.getRoles();

  if (roles.some((r) => STAFF_ROLES.has(r))) return true;
  if (roles.includes('PACIENTE') || roles.includes('PATIENT')) {
    return router.createUrlTree(['/login'], { queryParams: { error: 'staff-only' } });
  }
  return true;
};
