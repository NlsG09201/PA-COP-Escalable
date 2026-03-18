import { Injectable } from '@angular/core';
import { UserRole } from '../models/user-role.model';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly fallbackRole: UserRole = 'ADMIN';

  constructor(private readonly tokenStorage: TokenStorageService) {}

  getToken(): string | null {
    return this.tokenStorage.getAccessToken();
  }

  getRole(): UserRole {
    const token = this.getToken();
    if (!token) {
      return this.fallbackRole;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1])) as {
        role?: UserRole;
        roles?: string[];
        authorities?: string[];
      };

      const candidate = payload.role ?? payload.roles?.[0] ?? payload.authorities?.[0];
      if (candidate === 'ADMIN' || candidate === 'DENTIST' || candidate === 'PSYCHOLOGIST') {
        return candidate;
      }

      return this.fallbackRole;
    } catch {
      return this.fallbackRole;
    }
  }

  hasAnyRole(roles: UserRole[]): boolean {
    return roles.includes(this.getRole());
  }
}
