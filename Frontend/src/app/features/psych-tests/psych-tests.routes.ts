import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import {
  PsychQuestionVm,
  PsychTestOptionVm,
  PsychTestsApiService,
  PsychTestSubmissionVm,
  PsychTestTemplateVm
} from './data-access/psych-tests-api.service';
import { ClinicalHistoryApiService } from '../clinical-history/data-access/clinical-history-api.service';
import { selectSelectedPatient, selectSelectedPatientId } from '../../store/patients.selectors';
import { AiAssistApiService, AiClinicalSuggestionVm } from '../../core/services/ai-assist-api.service';
import { AiSuggestionPanelComponent } from '../ai-assist/components/ai-suggestion-panel.component';

const LIKERT_OPTIONS: PsychTestOptionVm[] = [
// ...
  { label: 'Nunca', value: '0', score: 0 },
  { label: 'Rara vez', value: '1', score: 1 },
  { label: 'A veces', value: '2', score: 2 },
  { label: 'Frecuente', value: '3', score: 3 },
  { label: 'Casi siempre', value: '4', score: 4 }
];

const BUILTIN_TEMPLATES: PsychTestTemplateVm[] = [
  {
    id: 'phq-9',
    name: 'PHQ-9',
    type: 'Depresion',
    description: 'Tamizaje breve para sintomatologia depresiva y seguimiento de severidad clinica.',
    questions: [
      { id: 'interest', prompt: 'Poco interes o placer en hacer las cosas.', type: 'likert', options: LIKERT_OPTIONS },
      { id: 'mood', prompt: 'Sentirse decaido, deprimido o sin esperanza.', type: 'likert', options: LIKERT_OPTIONS },
      { id: 'sleep', prompt: 'Problemas para dormir o dormir demasiado.', type: 'likert', options: LIKERT_OPTIONS },
      { id: 'energy', prompt: 'Cansancio o falta de energia.', type: 'likert', options: LIKERT_OPTIONS },
      { id: 'notes', prompt: 'Observaciones del profesional.', type: 'text', options: [] }
    ]
  },
  {
    id: 'gad-7',
    name: 'GAD-7',
    type: 'Ansiedad',
    description: 'Evaluacion estandarizada de preocupacion excesiva, tension y sintomas de ansiedad generalizada.',
    questions: [
      { id: 'nervous', prompt: 'Se ha sentido nervioso o con los nervios de punta.', type: 'likert', options: LIKERT_OPTIONS },
      { id: 'control', prompt: 'No ha podido dejar de preocuparse o controlar la preocupacion.', type: 'likert', options: LIKERT_OPTIONS },
      { id: 'relax', prompt: 'Ha tenido dificultad para relajarse.', type: 'likert', options: LIKERT_OPTIONS },
      { id: 'restless', prompt: 'Ha estado tan inquieto que no puede quedarse quieto.', type: 'likert', options: LIKERT_OPTIONS },
      { id: 'trigger', prompt: 'Principal detonante identificado en consulta.', type: 'text', options: [] }
    ]
  },
  {
    id: 'session-checkin',
    name: 'Chequeo de Sesion',
    type: 'Seguimiento',
    description: 'Test dinamico para control rapido antes o despues de una intervencion psicologica.',
    questions: [
      {
        id: 'goal',
        prompt: 'Como describiria el objetivo principal de la sesion actual?',
        type: 'single-choice',
        options: [
          { label: 'Regulacion emocional', value: 'regulacion', score: 3 },
          { label: 'Crisis aguda', value: 'crisis', score: 4 },
          { label: 'Seguimiento habitual', value: 'seguimiento', score: 2 },
          { label: 'Psicoeducacion', value: 'psicoeducacion', score: 1 }
        ]
      },
      { id: 'distress', prompt: 'Nivel de malestar percibido.', type: 'likert', options: LIKERT_OPTIONS },
      { id: 'support', prompt: 'Percibe soporte familiar y social suficiente.', type: 'single-choice', options: [
        { label: 'Si, consistente', value: 'high', score: 0 },
        { label: 'Parcial', value: 'medium', score: 2 },
        { label: 'No disponible', value: 'low', score: 4 }
      ] },
      { id: 'clinicalNotes', prompt: 'Notas clinicas adicionales.', type: 'text', options: [] }
    ]
  }
];

@Component({
  standalone: true,
  imports: [AsyncPipe, DatePipe, ReactiveFormsModule, AiSuggestionPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-shell">
      <div class="card border-0 shadow-sm hero-card">
        <div class="card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <p class="eyebrow mb-2">Psicologia Clinica</p>
            <h2 class="h4 mb-1">Motor de Tests Psicologicos</h2>
            <p class="text-muted mb-0">Selecciona un instrumento, completa el formulario y guarda resultados con clasificacion automatica.</p>
          </div>
          <div class="context-chip">
            <span class="context-label">Paciente activo</span>
            <strong>{{ (selectedPatient$ | async)?.name ?? 'Selecciona un paciente' }}</strong>
          </div>
        </div>
      </div>

      <div class="row g-4 mt-1">
        <div class="col-xl-4">
          <div class="card border-0 shadow-sm mb-4">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h3 class="h6 mb-1">Catalogo de instrumentos</h3>
                  <p class="text-muted small mb-0">{{ templates().length }} tests disponibles</p>
                </div>
              </div>

              <div class="template-list">
                @for (template of templates(); track template.id) {
                  <button
                    type="button"
                    class="template-card"
                    [class.active]="template.id === activeTemplateId()"
                    (click)="activateTemplate(template.id)">
                    <div class="d-flex justify-content-between align-items-start gap-3">
                      <div>
                        <strong>{{ template.name }}</strong>
                        <p class="small text-muted mb-2">{{ template.type }}</p>
                      </div>
                      <span class="badge rounded-pill text-bg-light">{{ template.questions.length }} items</span>
                    </div>
                    <p class="small mb-0">{{ template.description }}</p>
                  </button>
                }
              </div>
            </div>
          </div>

          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h3 class="h6 mb-1">Historial del paciente</h3>
                  <p class="text-muted small mb-0">Resultados recientes y score obtenido.</p>
                </div>
                <span class="badge rounded-pill text-bg-light">{{ history().length }}</span>
              </div>

              <div class="history-list">
                @for (entry of history(); track entry.id + entry.submittedAt) {
                  <article class="history-item">
                    <div class="d-flex justify-content-between gap-2">
                      <strong>{{ entry.templateName }}</strong>
                      <span class="text-muted small">{{ entry.submittedAt | date: 'shortDate' }}</span>
                    </div>
                    <p class="mb-1">Clasificacion: <strong>{{ entry.classification }}</strong></p>
                    <p class="mb-0 text-muted">Score: {{ entry.score }}</p>
                  </article>
                } @empty {
                  <div class="empty-state">Todavia no hay resultados guardados para este paciente.</div>
                }
              </div>
            </div>
          </div>
        </div>

        <div class="col-xl-8">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              @if (activeTemplate(); as template) {
                <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                  <div>
                    <p class="eyebrow mb-2">Instrumento activo</p>
                    <h3 class="h5 mb-1">{{ template.name }}</h3>
                    <p class="text-muted mb-0">{{ template.description }}</p>
                  </div>
                  <div class="metrics-grid">
                    <div class="metric-card">
                      <span>Preguntas</span>
                      <strong>{{ template.questions.length }}</strong>
                    </div>
                    <div class="metric-card">
                      <span>Ultimo resultado</span>
                      <strong>{{ lastResult()?.classification ?? 'Sin aplicar' }}</strong>
                    </div>
                  </div>
                </div>

                <form [formGroup]="testForm" (ngSubmit)="submitTest()" class="d-grid gap-4">
                  @for (question of template.questions; track question.id; let index = $index) {
                    <section class="question-card">
                      <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                        <div>
                          <span class="question-index">Pregunta {{ index + 1 }}</span>
                          <h4 class="h6 mb-1">{{ question.prompt }}</h4>
                          <p class="text-muted small mb-0">{{ describeQuestionType(question) }}</p>
                        </div>
                      </div>

                      @switch (question.type) {
                        @case ('likert') {
                          <div class="likert-grid">
                            @for (option of question.options; track option.value) {
                              <label class="option-card">
                                <input type="radio" [formControlName]="question.id" [value]="option.value" />
                                <span>{{ option.label }}</span>
                              </label>
                            }
                          </div>
                        }
                        @case ('single-choice') {
                          <div class="choices-grid">
                            @for (option of question.options; track option.value) {
                              <label class="choice-card">
                                <input type="radio" [formControlName]="question.id" [value]="option.value" />
                                <span>{{ option.label }}</span>
                              </label>
                            }
                          </div>
                        }
                        @default {
                          <textarea
                            class="form-control"
                            rows="4"
                            [formControlName]="question.id"
                            placeholder="Escribe aqui la respuesta clinica"></textarea>
                        }
                      }
                    </section>
                  }

                  <div class="d-flex justify-content-end">
                    <button class="btn btn-primary px-4" [disabled]="submitting() || testForm.invalid">
                      {{ submitting() ? 'Guardando resultado...' : 'Enviar y calcular resultado' }}
                    </button>
                  </div>
                </form>

                @if (lastResult() || aiLoading()) {
                <div class="row mt-4">
                  <div class="col-lg-7">
                    @if (lastResult(); as result) {
                      <div class="result-card h-100">
                        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
                          <div>
                            <p class="eyebrow mb-2">Resultado calculado</p>
                            <h4 class="h5 mb-1">{{ result.templateName }}</h4>
                            <p class="text-muted mb-0">{{ result.classification }}</p>
                          </div>
                          <div class="result-score">{{ result.score }}</div>
                        </div>
                      </div>
                    }
                  </div>
                  <div class="col-lg-5">
                    <app-ai-suggestion-panel
                      [suggestion]="aiSuggestion()"
                      [loading]="aiLoading()">
                    </app-ai-suggestion-panel>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .page-shell {
      display: grid;
      gap: 1.25rem;
    }

    .hero-card {
      background: linear-gradient(135deg, #ffffff 0%, #f8f7ff 100%);
    }

    .eyebrow {
      color: #7c3aed;
      font-size: 0.75rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
    }

    .context-chip {
      min-width: 220px;
      border: 1px solid #e9d8fd;
      border-radius: 18px;
      padding: 0.85rem 1rem;
      background: #faf5ff;
      display: grid;
      gap: 0.125rem;
    }

    .context-label {
      color: #667085;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .template-list,
    .history-list {
      display: grid;
      gap: 0.85rem;
    }

    .template-card {
      width: 100%;
      text-align: left;
      border: 1px solid #eceef3;
      border-radius: 18px;
      padding: 1rem;
      background: #fff;
      transition: border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease;
    }

    .template-card.active {
      border-color: #7c3aed;
      box-shadow: 0 12px 30px rgba(124, 58, 237, 0.12);
      transform: translateY(-1px);
    }

    .history-item,
    .question-card {
      border: 1px solid #edf2f7;
      border-radius: 18px;
      padding: 1rem;
      background: #fff;
    }

    .question-index {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0.2rem 0.6rem;
      background: #f4ebff;
      color: #6941c6;
      font-size: 0.75rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(120px, 1fr));
      gap: 0.75rem;
    }

    .metric-card {
      border-radius: 16px;
      padding: 0.85rem 1rem;
      background: #f8fafc;
      border: 1px solid #edf2f7;
      display: grid;
      gap: 0.25rem;
    }

    .metric-card span {
      color: #667085;
      font-size: 0.8rem;
    }

    .metric-card strong {
      font-size: 1rem;
    }

    .likert-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .choices-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .option-card,
    .choice-card {
      border: 1px solid #e4e7ec;
      border-radius: 16px;
      padding: 0.85rem;
      display: flex;
      align-items: center;
      gap: 0.65rem;
      background: #fcfcfd;
      cursor: pointer;
    }

    .option-card input,
    .choice-card input {
      margin: 0;
    }

    .result-card {
      border-radius: 20px;
      padding: 1.25rem;
      background: linear-gradient(135deg, #f4ebff 0%, #eef4ff 100%);
      border: 1px solid #ddd6fe;
    }

    .result-score {
      min-width: 80px;
      min-height: 80px;
      display: grid;
      place-items: center;
      border-radius: 22px;
      background: #fff;
      font-size: 2rem;
      font-weight: 800;
      color: #7c3aed;
    }

    .empty-state {
      border: 1px dashed #d0d5dd;
      border-radius: 16px;
      padding: 1rem;
      color: #667085;
      background: #fafafa;
    }

    @media (max-width: 992px) {
      .likert-grid,
      .choices-grid,
      .metrics-grid {
        grid-template-columns: 1fr;
      }
    }
  `
})
class PsychTestsPageComponent {
  private readonly testsApi = inject(PsychTestsApiService);
  private readonly clinicalApi = inject(ClinicalHistoryApiService);
  private readonly aiApi = inject(AiAssistApiService);
  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly selectedPatient$ = this.store.select(selectSelectedPatient);
  protected readonly templates = signal<PsychTestTemplateVm[]>(BUILTIN_TEMPLATES);
  protected readonly activeTemplateId = signal<string>(BUILTIN_TEMPLATES[0].id);
  protected readonly history = signal<PsychTestSubmissionVm[]>([]);
  protected readonly lastResult = signal<PsychTestSubmissionVm | null>(null);
  protected readonly submitting = signal(false);
  protected testForm = this.fb.group({});

  aiSuggestion = signal<AiClinicalSuggestionVm | null>(null);
  aiLoading = signal(false);

  private readonly patientId = signal<string | null>(null);
  protected readonly activeTemplate = computed(
    () => this.templates().find((template) => template.id === this.activeTemplateId()) ?? this.templates()[0] ?? null
  );

  constructor() {
    this.testsApi
      .templates$()
      .pipe(catchError(() => of([])), takeUntilDestroyed(this.destroyRef))
      .subscribe((templates) => {
        this.templates.set(this.mergeTemplates(templates));
        if (!this.templates().some((template) => template.id === this.activeTemplateId())) {
          this.activeTemplateId.set(this.templates()[0]?.id ?? '');
        }
        this.rebuildForm();
      });

    this.store
      .select(selectSelectedPatientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((patientId) => {
        this.patientId.set(patientId);
        this.aiSuggestion.set(null);
        this.loadHistory(patientId);
      });

    this.rebuildForm();
  }

  protected activateTemplate(templateId: string): void {
    this.activeTemplateId.set(templateId);
    this.aiSuggestion.set(null);
    this.rebuildForm();
  }

  protected describeQuestionType(question: PsychQuestionVm): string {
    if (question.type === 'likert') {
      return 'Escala Likert con severidad gradual';
    }
    if (question.type === 'single-choice') {
      return 'Seleccion unica con scoring asociado';
    }
    return 'Respuesta abierta para analisis clinico';
  }

  protected submitTest(): void {
    if (this.testForm.invalid || !this.activeTemplate()) {
      this.testForm.markAllAsTouched();
      return;
    }

    const template = this.activeTemplate()!;
    const answers = Object.entries(this.testForm.getRawValue()).reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = String(value ?? '');
      return acc;
    }, {});

    const score = this.calculateScore(template, answers);
    const classification = this.classify(template, score);
    const optimistic: PsychTestSubmissionVm = {
      id: crypto.randomUUID(),
      templateId: template.id,
      templateName: template.name,
      score,
      classification,
      submittedAt: new Date().toISOString(),
      answers
    };

    this.lastResult.set(optimistic);
    this.history.update((history) => [optimistic, ...history]);

    const patientId = this.patientId();
    if (!patientId) {
      return;
    }

    this.submitting.set(true);
    this.testsApi
      .submit$(patientId, {
        templateId: template.id,
        score,
        classification,
        answersByQuestionId: answers
      })
      .pipe(
        switchMap((saved) =>
          this.clinicalApi
            .addEntry$(patientId, {
              category: 'PSYCHOLOGICAL',
              type: `Test ${template.name}`,
              note: this.buildClinicalNote(saved, template)
            })
            .pipe(
              catchError(() => of(void 0)),
              map(() => saved)
            )
        ),
        catchError(() => of(optimistic)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((saved) => {
        this.history.update((history) => [
          saved,
          ...history.filter((entry) => entry.id !== optimistic.id)
        ]);
        this.lastResult.set(saved);
        this.submitting.set(false);

        // Trigger AI analysis
        if (patientId) {
          this.aiLoading.set(true);
          this.aiApi.analyzePsychSubmission$(patientId, saved.id).subscribe({
            next: (aiRes) => {
              this.aiSuggestion.set(aiRes);
              this.aiLoading.set(false);
            },
            error: () => this.aiLoading.set(false)
          });
        }
      });
  }

  private loadHistory(patientId: string | null): void {
    if (!patientId) {
      this.history.set([]);
      this.lastResult.set(null);
      return;
    }

    this.testsApi
      .submissions$(patientId)
      .pipe(catchError(() => of([])), takeUntilDestroyed(this.destroyRef))
      .subscribe((entries) => {
        const sorted = [...entries].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
        this.history.set(sorted);
        this.lastResult.set(sorted[0] ?? null);
      });
  }

  private rebuildForm(): void {
    const template = this.activeTemplate();
    const controls = (template?.questions ?? []).reduce<Record<string, ReturnType<FormBuilder['control']>>>((acc, question) => {
      const validators = question.type === 'text' ? [] : [Validators.required];
      acc[question.id] = this.fb.control('', validators);
      return acc;
    }, {});
    this.testForm = this.fb.group(controls);
  }

  private mergeTemplates(remoteTemplates: PsychTestTemplateVm[]): PsychTestTemplateVm[] {
    if (remoteTemplates.length === 0) {
      return BUILTIN_TEMPLATES;
    }

    const byId = new Map(BUILTIN_TEMPLATES.map((template) => [template.id, template]));
    remoteTemplates.forEach((template) => {
      const builtin = byId.get(template.id);
      byId.set(template.id, {
        ...builtin,
        ...template,
        questions: template.questions.length > 0 ? template.questions : builtin?.questions ?? []
      });
    });
    return [...byId.values()];
  }

  private calculateScore(template: PsychTestTemplateVm, answers: Record<string, string>): number {
    return template.questions.reduce((total, question) => {
      const answer = answers[question.id];
      if (!answer) {
        return total;
      }
      const selectedOption = question.options.find((option) => option.value === answer);
      if (typeof selectedOption?.score === 'number') {
        return total + selectedOption.score;
      }
      const numericScore = Number(answer);
      return Number.isFinite(numericScore) ? total + numericScore : total;
    }, 0);
  }

  private classify(template: PsychTestTemplateVm, score: number): string {
    if (template.id === 'phq-9') {
      if (score <= 4) return 'Minimo';
      if (score <= 9) return 'Leve';
      if (score <= 14) return 'Moderado';
      return 'Severo';
    }

    if (template.id === 'gad-7') {
      if (score <= 4) return 'Minima ansiedad';
      if (score <= 9) return 'Ansiedad leve';
      if (score <= 14) return 'Ansiedad moderada';
      return 'Ansiedad severa';
    }

    if (score <= 3) {
      return 'Estable';
    }
    if (score <= 7) {
      return 'Seguimiento recomendado';
    }
    return 'Intervencion prioritaria';
  }

  private buildClinicalNote(submission: PsychTestSubmissionVm, template: PsychTestTemplateVm): string {
    const answersSummary = template.questions
      .map((question) => {
        const answer = submission.answers[question.id];
        if (!answer) {
          return null;
        }
        return `${question.prompt}: ${answer}`;
      })
      .filter((entry): entry is string => entry !== null)
      .join(' | ');

    return `Resultado ${template.name}. Puntaje: ${submission.score}. Clasificacion: ${submission.classification}.${answersSummary ? ` Respuestas clave: ${answersSummary}` : ''}`;
  }
}

export const PSYCH_TESTS_ROUTES: Routes = [{ path: '', component: PsychTestsPageComponent }];
