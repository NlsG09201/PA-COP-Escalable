import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface PortalTimelineEntry {
  date: string;
  type: string;
  title: string;
  description: string;
}

export interface PortalTreatment {
  id: string;
  name: string;
  status: string;
  startDate: string;
  estimatedEndDate?: string;
  progressPercent: number;
}

export interface PortalAppointment {
  id: string;
  date: string;
  time: string;
  type: string;
  professionalName: string;
  status: string;
}

export interface PortalTherapyProgress {
  totalSessions: number;
  completedSessions: number;
  avgScore: number;
  streakDays: number;
}

export interface PortalDashboard {
  patientName: string;
  nextAppointment?: PortalAppointment;
  activeTreatments: PortalTreatment[];
  therapyProgress: PortalTherapyProgress;
  recentTimeline: PortalTimelineEntry[];
}

export interface PortalAccessToken {
  token: string;
  patientId: string;
  expiresAt: string;
}

@Injectable({ providedIn: 'root' })
export class PortalApiService {
  constructor(private readonly http: HttpClient) {}

  generateToken$(patientId: string): Observable<PortalAccessToken> {
    return this.http.post<PortalAccessToken>(`${API_BASE_URL}/api/portal/patients/${patientId}/token`, {});
  }

  authenticate$(token: string): Observable<PortalAccessToken> {
    return this.http.post<PortalAccessToken>(`${API_BASE_URL}/api/portal/authenticate`, { token });
  }

  getDashboard$(): Observable<PortalDashboard> {
    return this.http.get<PortalDashboard>(`${API_BASE_URL}/api/portal/dashboard`);
  }

  getTimeline$(): Observable<PortalTimelineEntry[]> {
    return this.http.get<PortalTimelineEntry[]>(`${API_BASE_URL}/api/portal/timeline`);
  }

  getTreatments$(): Observable<PortalTreatment[]> {
    return this.http.get<PortalTreatment[]>(`${API_BASE_URL}/api/portal/treatments`);
  }

  getAppointments$(): Observable<PortalAppointment[]> {
    return this.http.get<PortalAppointment[]>(`${API_BASE_URL}/api/portal/appointments`);
  }

  getTherapyProgress$(): Observable<PortalTherapyProgress> {
    return this.http.get<PortalTherapyProgress>(`${API_BASE_URL}/api/portal/therapy-progress`);
  }
}
