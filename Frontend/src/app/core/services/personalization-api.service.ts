import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface PreferenceProfile {
  id: string;
  patientId: string;
  communicationPreference: string;
  schedulePreference: string;
  contentPreferences: string[];
  anxietyLevel: string;
  techComfort: string;
  languagePreference: string;
  calculatedAt: string;
}

export interface PersonalizedRecommendation {
  type: string;
  title: string;
  description: string;
  priority: number;
  reasoning: string;
}

@Injectable({ providedIn: 'root' })
export class PersonalizationApiService {
  constructor(private readonly http: HttpClient) {}

  getProfile$(patientId: string): Observable<PreferenceProfile> {
    return this.http.get<PreferenceProfile>(`${API_BASE_URL}/api/personalization/patients/${patientId}/profile`);
  }

  calculateProfile$(patientId: string): Observable<PreferenceProfile> {
    return this.http.post<PreferenceProfile>(`${API_BASE_URL}/api/personalization/patients/${patientId}/calculate`, {});
  }

  getRecommendations$(patientId: string): Observable<PersonalizedRecommendation[]> {
    return this.http.get<PersonalizedRecommendation[]>(`${API_BASE_URL}/api/personalization/patients/${patientId}/recommendations`);
  }
}
