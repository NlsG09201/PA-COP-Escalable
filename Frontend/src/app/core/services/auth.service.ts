import { Injectable } from '@angular/core';
import { UserRole } from '../models/user-role.model';
import { TokenStorageService } from './token-storage.service';

const ROLE_PRIORITY: UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'ORG_ADMIN',
  'SITE_ADMIN',
  'MEDICO',
  'PROFESSIONAL',
  'PATIENT',
  'PACIENTE',
];
const KNOWN_ROLES = new Set<UserRole>(ROLE_PRIORITY);

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly fallbackRole: UserRole = 'ADMIN';

  constructor(private readonly tokenStorage: TokenStorageService) {}

  getToken(): string | null {
    return this.tokenStorage.getAccessToken();
  }

  getRole(): UserRole {
    return this.getRoles()[0] ?? this.fallbackRole;
  }

  getRoles(): UserRole[] {
    const token = this.getToken();
    if (!token) {
      return [this.fallbackRole];
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1])) as {
        role?: string;
        roles?: string[];
        authorities?: string[];
      };
      const rawRoles = [
        payload.role,
        ...(payload.roles ?? []),
        ...(payload.authorities ?? [])
      ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0);

      const uniqueRoles = Array.from(new Set(rawRoles)).filter((role): role is UserRole => KNOWN_ROLES.has(role as UserRole));
      if (uniqueRoles.length === 0) {
        return [this.fallbackRole];
      }

      return uniqueRoles.sort((left, right) => ROLE_PRIORITY.indexOf(left) - ROLE_PRIORITY.indexOf(right));
    } catch {
      return [this.fallbackRole];
    }
  }

  hasAnyRole(roles: UserRole[]): boolean {
    const currentRoles = this.getRoles();
    return roles.some((role) => currentRoles.includes(role));
  }

  getSiteId(): string | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1] ?? '';
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      const payload = JSON.parse(atob(padded)) as { site_id?: unknown };
      const siteId = payload.site_id;
      return siteId != null && String(siteId).trim() ? String(siteId) : null;
    } catch {
      return null;
    }
  }
}
