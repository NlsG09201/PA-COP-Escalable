import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface SatisfactionSurvey {
  id: string;
  patientId: string;
  triggerEvent: string;
  npsScore?: number;
  feedback?: string;
  status: string;
  completedAt?: string;
  createdAt: string;
}

export interface ChurnPrediction {
  id: string;
  patientId: string;
  churnProbability: number;
  riskLevel: string;
  factors: string[];
  recommendedActions: string[];
  calculatedAt: string;
}

export interface PatientExperience {
  surveys: SatisfactionSurvey[];
  avgNps: number;
  churnPrediction?: ChurnPrediction;
}

export interface SiteMetrics {
  totalPatients: number;
  avgNps: number;
  responseRate: number;
  churnRiskDistribution: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class ExperienceApiService {
  constructor(private readonly http: HttpClient) {}

  sendNpsSurvey$(patientId: string, triggerEvent: string): Observable<SatisfactionSurvey> {
    return this.http.post<SatisfactionSurvey>(`${API_BASE_URL}/api/experience/patients/${patientId}/surveys`, { triggerEvent });
  }

  completeSurvey$(surveyId: string, npsScore: number, feedback?: string): Observable<SatisfactionSurvey> {
    return this.http.post<SatisfactionSurvey>(`${API_BASE_URL}/api/experience/surveys/${surveyId}/complete`, { npsScore, feedback });
  }

  getPatientExperience$(patientId: string): Observable<PatientExperience> {
    return this.http.get<PatientExperience>(`${API_BASE_URL}/api/experience/patients/${patientId}`);
  }

  getSiteMetrics$(): Observable<SiteMetrics> {
    return this.http.get<SiteMetrics>(`${API_BASE_URL}/api/experience/metrics`);
  }

  predictChurn$(patientId: string): Observable<ChurnPrediction> {
    return this.http.post<ChurnPrediction>(`${API_BASE_URL}/api/experience/patients/${patientId}/churn-prediction`, {});
  }
}
