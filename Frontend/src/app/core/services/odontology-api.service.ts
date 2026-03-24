import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface TreatmentStepVm {
  toothCode: string;
  description: string;
  estimatedCost: number;
  completed: boolean;
}

export interface TreatmentPlanVm {
  id: string;
  patientId: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  steps: TreatmentStepVm[];
}

@Injectable({ providedIn: 'root' })
export class OdontologyApiService {
  constructor(private readonly http: HttpClient) {}

  suggestPlan$(patientId: string): Observable<TreatmentPlanVm> {
    return this.http.post<TreatmentPlanVm>(`${API_BASE_URL}/api/odontology/patients/${patientId}/suggest-plan`, {});
  }

  getPatientPlans$(patientId: string): Observable<TreatmentPlanVm[]> {
    return this.http.get<TreatmentPlanVm[]>(`${API_BASE_URL}/api/odontology/patients/${patientId}/plans`);
  }
}
