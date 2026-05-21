import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly accessTokenKey = 'cop_dashboard_token';
  private readonly refreshTokenKey = 'cop_dashboard_refresh_token';
  private readonly activeSiteNameKey = 'cop_active_site_name';

  getAccessToken(): string | null {
    return localStorage.getItem(this.accessTokenKey);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  setTokens(accessToken: string, refreshToken?: string): void {
    localStorage.setItem(this.accessTokenKey, accessToken);
    if (refreshToken) {
      localStorage.setItem(this.refreshTokenKey, refreshToken);
    }
  }

  setActiveSiteName(name: string): void {
    sessionStorage.setItem(this.activeSiteNameKey, name.trim());
  }

  getActiveSiteName(): string | null {
    const name = sessionStorage.getItem(this.activeSiteNameKey);
    return name?.trim() ? name : null;
  }

  clear(): void {
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    sessionStorage.removeItem(this.activeSiteNameKey);
  }
}
