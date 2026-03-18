import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export type PsychQuestionType = 'single-choice' | 'likert' | 'text';

export interface PsychTestOptionVm {
  label: string;
  value: string;
  score?: number;
}

export interface PsychQuestionVm {
  id: string;
  prompt: string;
  type: PsychQuestionType;
  options: PsychTestOptionVm[];
}

export interface PsychTestTemplateVm {
  id: string;
  name: string;
  type: string;
  description: string;
  questions: PsychQuestionVm[];
}

export interface PsychTestSubmissionVm {
  id: string;
  templateId: string;
  templateName: string;
  score: number;
  classification: string;
  submittedAt: string;
  answers: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class PsychTestsApiService {
  constructor(private readonly http: HttpClient) {}

  templates$(): Observable<PsychTestTemplateVm[]> {
    return this.http.get<unknown>(`${API_BASE_URL}/api/psych-tests/templates`).pipe(
      map((raw) => this.toArray(raw).map((entry) => this.mapTemplate(entry)))
    );
  }

  submissions$(patientId: string): Observable<PsychTestSubmissionVm[]> {
    return this.http.get<unknown>(`${API_BASE_URL}/api/psych-tests/patients/${patientId}/submissions`).pipe(
      map((raw) => this.toArray(raw).map((entry) => this.mapSubmission(entry)))
    );
  }

  submit$(
    patientId: string,
    payload: {
      templateId: string;
      score: number;
      classification: string;
      answersByQuestionId: Record<string, string>;
    }
  ): Observable<PsychTestSubmissionVm> {
    return this.http.post<unknown>(`${API_BASE_URL}/api/psych-tests/patients/${patientId}/submissions`, payload).pipe(
      map((raw) => this.mapSubmission(this.toObject(raw)))
    );
  }

  private mapTemplate(entry: Record<string, unknown>): PsychTestTemplateVm {
    return {
      id: String(entry['id'] ?? crypto.randomUUID()),
      name: String(entry['name'] ?? 'Test Psicologico'),
      type: String(entry['type'] ?? 'General'),
      description: String(entry['description'] ?? ''),
      questions: this.toQuestions(entry['questions'])
    };
  }

  private toArray(raw: unknown): Record<string, unknown>[] {
    if (Array.isArray(raw)) {
      return raw.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
    }
    if (typeof raw === 'object' && raw !== null && Array.isArray((raw as { data?: unknown }).data)) {
      return (raw as { data: Record<string, unknown>[] }).data;
    }
    return [];
  }

  private toQuestions(raw: unknown): PsychQuestionVm[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((entry, index) => ({
        id: String(entry['id'] ?? `q-${index + 1}`),
        prompt: String(entry['prompt'] ?? entry['question'] ?? `Pregunta ${index + 1}`),
        type: this.normalizeQuestionType(entry['type']),
        options: this.toOptions(entry['options'])
      }));
  }

  private toOptions(raw: unknown): PsychTestOptionVm[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((entry, index) => ({
        label: String(entry['label'] ?? entry['text'] ?? `Opcion ${index + 1}`),
        value: String(entry['value'] ?? entry['id'] ?? `option-${index + 1}`),
        score: typeof entry['score'] === 'number' ? entry['score'] : undefined
      }));
  }

  private normalizeQuestionType(raw: unknown): PsychQuestionType {
    const candidate = String(raw ?? 'text').toLowerCase();
    if (candidate === 'likert') {
      return 'likert';
    }
    if (candidate === 'single-choice' || candidate === 'single_choice' || candidate === 'multiple-choice') {
      return 'single-choice';
    }
    return 'text';
  }

  private mapSubmission(entry: Record<string, unknown>): PsychTestSubmissionVm {
    return {
      id: String(entry['id'] ?? crypto.randomUUID()),
      templateId: String(entry['templateId'] ?? ''),
      templateName: String(entry['templateName'] ?? entry['testName'] ?? 'Test psicologico'),
      score: Number(entry['score'] ?? 0),
      classification: String(entry['classification'] ?? 'Sin clasificacion'),
      submittedAt: String(entry['submittedAt'] ?? entry['createdAt'] ?? new Date().toISOString()),
      answers: this.toAnswers(entry['answers'] ?? entry['answersByQuestionId'])
    };
  }

  private toAnswers(raw: unknown): Record<string, string> {
    if (typeof raw !== 'object' || raw === null) {
      return {};
    }
    return Object.entries(raw as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = String(value ?? '');
      return acc;
    }, {});
  }

  private toObject(raw: unknown): Record<string, unknown> {
    if (typeof raw === 'object' && raw !== null) {
      return raw as Record<string, unknown>;
    }
    return {};
  }
}
