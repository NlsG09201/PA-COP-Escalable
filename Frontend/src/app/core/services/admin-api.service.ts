import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface AdminUserVm {
  id: string;
  username: string;
  email: string | null;
  roles: string[];
}

export interface AdminSiteVm {
  id: string;
  name: string;
  department: string | null;
  municipality: string | null;
  address: string | null;
  organization_id: string;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  constructor(private readonly http: HttpClient) {}

  listUsers$(search = '', limit = 50): Observable<AdminUserVm[]> {
    const params: Record<string, string> = { limit: String(limit) };
    if (search.trim()) params['search'] = search.trim();
    return this.http.get<AdminUserVm[]>(`${API_BASE_URL}/api/admin/users`, { params });
  }

  assignRole$(username: string, role: 'MEDICO' | 'PROFESSIONAL' | 'PACIENTE'): Observable<{ ok: boolean; message: string }> {
    return this.http.post<{ ok: boolean; message: string }>(`${API_BASE_URL}/api/admin/users/assign-role`, {
      username,
      role,
    });
  }

  listSites$(): Observable<AdminSiteVm[]> {
    return this.http.get<AdminSiteVm[]>(`${API_BASE_URL}/api/sites`);
  }

  syncSitesCatalog$(): Observable<{ created: number; totalActive: number; catalogSize: number }> {
    return this.http.post<{ created: number; totalActive: number; catalogSize: number }>(
      `${API_BASE_URL}/api/sites/sync-catalog`,
      {},
    );
  }
}
