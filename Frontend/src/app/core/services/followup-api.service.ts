import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface FollowupQuestion {
  id: string;
  questionText: string;
  questionType: string;
  options?: string[];
  required: boolean;
  orderIndex: number;
}

export interface QuestionAnswer {
  questionId: string;
  answerText: string;
  answerValue?: number;
}

export interface FollowupSurvey {
  id: string;
  patientId: string;
  treatmentType: string;
  triggerEvent: string;
  questions: FollowupQuestion[];
  status: string;
  completedAt?: string;
  createdAt: string;
}

export interface FollowupSchedule {
  id: string;
  patientId: string;
  surveyType: string;
  scheduledDate: string;
  status: string;
  recurrenceRule?: string;
}

@Injectable({ providedIn: 'root' })
export class FollowupApiService {
  constructor(private readonly http: HttpClient) {}

  getSurveys$(patientId: string): Observable<FollowupSurvey[]> {
    return this.http.get<FollowupSurvey[]>(`${API_BASE_URL}/api/followup/patients/${patientId}/surveys`);
  }

  generateSurvey$(patientId: string, treatmentType: string, triggerEvent: string): Observable<FollowupSurvey> {
    // Backend endpoint is /patients/{patientId}/generate
    return this.http.post<FollowupSurvey>(`${API_BASE_URL}/api/followup/patients/${patientId}/generate`, { treatmentType, triggerEvent });
  }

  completeSurvey$(surveyId: string, answers: QuestionAnswer[]): Observable<FollowupSurvey> {
    // Backend expects the answers array directly (List<QuestionAnswer>), not wrapped in { answers }.
    return this.http.post<FollowupSurvey>(`${API_BASE_URL}/api/followup/surveys/${surveyId}/complete`, answers);
  }

  getSchedules$(patientId: string): Observable<FollowupSchedule[]> {
    return this.http.get<FollowupSchedule[]>(`${API_BASE_URL}/api/followup/patients/${patientId}/schedules`);
  }
}
