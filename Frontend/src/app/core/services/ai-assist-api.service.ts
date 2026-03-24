import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export type AiAssistSourceType = 'PSYCH_TEST_SUBMISSION' | 'CLINICAL_INTERVIEW' | 'INITIAL_EVALUATION';
export type AiRiskLevel = 'low' | 'medium' | 'high' | 'critical' | 'unknown';
export type AiSuggestionStatus = 'QUEUED' | 'PROCESSING' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'FAILED';

export interface AiCandidateCondition {
  label: string;
  rationale: string;
  confidence_0_to_1: number;
}

export interface AiStructuredOutput {
  disclaimer: string;
  risk_level: AiRiskLevel;
  human_review_required: boolean;
  candidate_conditions: AiCandidateCondition[];
  supporting_signals: string[];
  recommended_clarifying_questions: string[];
  recommended_non_diagnostic_actions: string[];
  evidence_quotes_from_input: string[];
}

export interface AiClinicalSuggestionVm {
  id: string;
  patientId: string;
  sourceType: AiAssistSourceType;
  status: AiSuggestionStatus;
  riskLevel: AiRiskLevel;
  headline: string;
  structuredJson: string; // This is a JSON string of AiStructuredOutput
  createdAt: string;
  reviewNote?: string;
}

@Injectable({ providedIn: 'root' })
export class AiAssistApiService {
  constructor(private readonly http: HttpClient) {}

  analyzeContext$(patientId: string, sourceType: AiAssistSourceType, clinicalContext: string): Observable<AiClinicalSuggestionVm> {
    return this.http.post<AiClinicalSuggestionVm>(`${API_BASE_URL}/api/ai-assist/patients/${patientId}/analyze-context`, {
      sourceType,
      clinicalContext
    });
  }

  analyzePsychSubmission$(patientId: string, submissionId: string, sync = true): Observable<AiClinicalSuggestionVm> {
    return this.http.post<AiClinicalSuggestionVm>(`${API_BASE_URL}/api/ai-assist/patients/${patientId}/psych-tests/submissions/${submissionId}/analyze?sync=${sync}`, {});
  }

  getLatestForPatient$(patientId: string): Observable<AiClinicalSuggestionVm> {
    return this.http.get<AiClinicalSuggestionVm>(`${API_BASE_URL}/api/ai-assist/patients/${patientId}/suggestions/latest`);
  }

  approve$(suggestionId: string, note?: string): Observable<AiClinicalSuggestionVm> {
    return this.http.post<AiClinicalSuggestionVm>(`${API_BASE_URL}/api/ai-assist/suggestions/${suggestionId}/approve`, { note });
  }

  reject$(suggestionId: string, reason?: string): Observable<AiClinicalSuggestionVm> {
    return this.http.post<AiClinicalSuggestionVm>(`${API_BASE_URL}/api/ai-assist/suggestions/${suggestionId}/reject`, { reason });
  }

  parseStructuredOutput(suggestion: AiClinicalSuggestionVm): AiStructuredOutput {
    try {
      return JSON.parse(suggestion.structuredJson);
    } catch (e) {
      return {
        disclaimer: 'Error al procesar la salida del modelo.',
        risk_level: 'unknown',
        human_review_required: true,
        candidate_conditions: [],
        supporting_signals: [],
        recommended_clarifying_questions: [],
        recommended_non_diagnostic_actions: [],
        evidence_quotes_from_input: []
      };
    }
  }
}
