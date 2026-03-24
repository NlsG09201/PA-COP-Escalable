import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';
import { selectSelectedPatientId } from '../../store/patients.selectors';
import {
  FollowupApiService,
  FollowupSurvey,
  FollowupSchedule,
  FollowupQuestion,
  QuestionAnswer,
} from '../../core/services/followup-api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid py-3">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h4 class="mb-0 fw-bold">
          <i class="bi bi-clipboard2-pulse me-2 text-primary"></i>Seguimiento
        </h4>
        @if (!patientId()) {
          <span class="badge text-bg-warning">Seleccione un paciente</span>
        } @else {
          <button
            class="btn btn-primary btn-sm"
            [disabled]="generatingSurvey()"
            (click)="generateSurvey()"
          >
            @if (generatingSurvey()) {
              <span class="spinner-border spinner-border-sm me-1"></span>
            }
            <i class="bi bi-plus-circle me-1"></i>Generar Encuesta
          </button>
        }
      </div>

      @if (!patientId()) {
        <div class="alert alert-info d-flex align-items-center gap-2">
          <i class="bi bi-info-circle"></i>
          Seleccione un paciente para gestionar el seguimiento clinico.
        </div>
      } @else {
        @if (error()) {
          <div class="alert alert-danger">{{ error() }}</div>
        }

        <div class="row g-4">
          <!-- Left Column: Surveys & Form -->
          <div class="col-lg-7">
            <!-- Pending Surveys -->
            <div class="card border-0 shadow-sm mb-4">
              <div class="card-body">
                <h6 class="card-title mb-3">
                  <i class="bi bi-clipboard-check me-2"></i>Encuestas Pendientes
                </h6>

                @if (loading()) {
                  <div class="text-center py-4">
                    <div class="spinner-border text-primary"></div>
                  </div>
                } @else if (pendingSurveys().length === 0) {
                  <div class="text-center text-muted py-4">
                    <i class="bi bi-check-circle display-4"></i>
                    <p class="mt-2">No hay encuestas pendientes.</p>
                  </div>
                } @else {
                  @for (survey of pendingSurveys(); track survey.id) {
                    <div
                      class="survey-card p-3 rounded-3 mb-3"
                      [class.active]="
                        activeSurvey() && activeSurvey()!.id === survey.id
                      "
                      (click)="openSurvey(survey)"
                      role="button"
                    >
                      <div
                        class="d-flex justify-content-between align-items-start"
                      >
                        <div>
                          <div class="fw-semibold">
                            {{ survey.treatmentType }}
                          </div>
                          <small class="text-muted">
                            {{ survey.triggerEvent }} •
                            {{ survey.createdAt | date: 'dd/MM/yyyy' }}
                          </small>
                        </div>
                        <span class="badge text-bg-warning rounded-pill">
                          {{ survey.questions.length }} preguntas
                        </span>
                      </div>
                    </div>
                  }
                }
              </div>
            </div>

            <!-- Survey Form -->
            @if (activeSurvey()) {
              <div class="card border-0 shadow-sm mb-4">
                <div class="card-body">
                  <div
                    class="d-flex justify-content-between align-items-center mb-4"
                  >
                    <h6 class="card-title mb-0">
                      Completar Encuesta: {{ activeSurvey()!.treatmentType }}
                    </h6>
                    <button
                      class="btn btn-sm btn-outline-secondary"
                      (click)="closeSurvey()"
                    >
                      <i class="bi bi-x-lg"></i>
                    </button>
                  </div>

                  <form (ngSubmit)="submitSurvey()">
                    @for (
                      q of activeSurvey()!.questions;
                      track q.id;
                      let idx = $index
                    ) {
                      <div class="mb-4 p-3 bg-light rounded-3">
                        <label class="form-label fw-semibold">
                          {{ idx + 1 }}. {{ q.questionText }}
                          @if (q.required) {
                            <span class="text-danger">*</span>
                          }
                        </label>

                        @if (q.questionType === 'SCALE') {
                          <div
                            class="d-flex gap-2 flex-wrap mt-2"
                          >
                            @for (val of [1, 2, 3, 4, 5]; track val) {
                              <div class="form-check form-check-inline">
                                <input
                                  class="form-check-input"
                                  type="radio"
                                  [name]="'q_' + q.id"
                                  [id]="'q_' + q.id + '_' + val"
                                  [value]="val"
                                  [ngModel]="getAnswer(q.id)?.answerValue"
                                  (ngModelChange)="
                                    setScaleAnswer(q.id, val)
                                  "
                                />
                                <label
                                  class="form-check-label score-label"
                                  [for]="'q_' + q.id + '_' + val"
                                  [class.score-low]="val <= 2"
                                  [class.score-mid]="val === 3"
                                  [class.score-high]="val >= 4"
                                >
                                  {{ val }}
                                </label>
                              </div>
                            }
                          </div>
                          <div class="d-flex justify-content-between mt-1">
                            <small class="text-muted">Muy malo</small>
                            <small class="text-muted">Excelente</small>
                          </div>
                        } @else if (
                          q.questionType === 'CHOICE' && q.options
                        ) {
                          @for (opt of q.options; track opt) {
                            <div class="form-check mt-1">
                              <input
                                class="form-check-input"
                                type="radio"
                                [name]="'q_' + q.id"
                                [id]="'q_' + q.id + '_' + opt"
                                [value]="opt"
                                [ngModel]="getAnswer(q.id)?.answerText"
                                (ngModelChange)="
                                  setTextAnswer(q.id, opt)
                                "
                              />
                              <label
                                class="form-check-label"
                                [for]="'q_' + q.id + '_' + opt"
                              >
                                {{ opt }}
                              </label>
                            </div>
                          }
                        } @else {
                          <textarea
                            class="form-control mt-2"
                            rows="3"
                            [placeholder]="'Escriba su respuesta...'"
                            [ngModel]="getAnswer(q.id)?.answerText ?? ''"
                            (ngModelChange)="setTextAnswer(q.id, $event)"
                            [name]="'q_' + q.id"
                          ></textarea>
                        }
                      </div>
                    }

                    <!-- Risk alert -->
                    @if (riskDetected()) {
                      <div
                        class="alert alert-danger d-flex align-items-center gap-2 mb-3"
                      >
                        <i class="bi bi-exclamation-triangle-fill"></i>
                        <strong
                          >Alerta de riesgo detectada en las
                          respuestas.</strong
                        >
                        Se recomienda evaluacion clinica inmediata.
                      </div>
                    }

                    <button
                      type="submit"
                      class="btn btn-primary w-100"
                      [disabled]="submitting()"
                    >
                      @if (submitting()) {
                        <span
                          class="spinner-border spinner-border-sm me-1"
                        ></span>
                      }
                      <i class="bi bi-check2-circle me-1"></i>Completar
                      Encuesta
                    </button>
                  </form>
                </div>
              </div>
            }
          </div>

          <!-- Right Column: Schedules & Timeline -->
          <div class="col-lg-5">
            <!-- Scheduled Controls -->
            <div class="card border-0 shadow-sm mb-4">
              <div class="card-body">
                <h6 class="card-title mb-3">
                  <i class="bi bi-calendar-check me-2"></i>Controles
                  Programados
                </h6>

                @if (schedules().length === 0) {
                  <p class="text-muted small text-center py-3">
                    No hay controles programados.
                  </p>
                } @else {
                  @for (sch of schedules(); track sch.id) {
                    <div
                      class="schedule-item d-flex justify-content-between align-items-center p-3 rounded-3 mb-2"
                    >
                      <div>
                        <div class="fw-semibold small">
                          {{ sch.surveyType }}
                        </div>
                        <small class="text-muted">
                          {{ sch.scheduledDate | date: 'dd/MM/yyyy' }}
                          @if (sch.recurrenceRule) {
                            • {{ sch.recurrenceRule }}
                          }
                        </small>
                      </div>
                      <span
                        class="badge rounded-pill"
                        [class]="scheduleBadge(sch.status)"
                        >{{ sch.status }}</span
                      >
                    </div>
                  }
                }
              </div>
            </div>

            <!-- Timeline of Completed Surveys -->
            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <h6 class="card-title mb-3">
                  <i class="bi bi-clock-history me-2"></i>Historial de
                  Encuestas
                </h6>

                @if (completedSurveys().length === 0) {
                  <p class="text-muted small text-center py-3">
                    No hay encuestas completadas.
                  </p>
                } @else {
                  <div class="timeline">
                    @for (
                      survey of completedSurveys();
                      track survey.id;
                      let last = $last
                    ) {
                      <div
                        class="timeline-item"
                        [class.timeline-last]="last"
                      >
                        <div class="timeline-dot"></div>
                        <div class="timeline-content p-3 rounded-3 mb-3">
                          <div
                            class="d-flex justify-content-between align-items-start mb-1"
                          >
                            <strong class="small">{{
                              survey.treatmentType
                            }}</strong>
                            <small class="text-muted">{{
                              survey.completedAt
                                | date: 'dd/MM/yyyy'
                            }}</small>
                          </div>
                          <small class="text-muted d-block mb-2">
                            {{ survey.triggerEvent }} •
                            {{ survey.questions.length }} preguntas
                          </small>
                          <span
                            class="badge text-bg-success rounded-pill"
                            >Completada</span
                          >
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .survey-card {
        background: #f8f9fa;
        border: 1px solid transparent;
        transition: all 0.15s;
      }
      .survey-card:hover {
        background: #e9ecef;
      }
      .survey-card.active {
        border-color: #0d6efd;
        background: #e8f0fe;
      }
      .schedule-item {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
      }
      .score-label {
        font-weight: 600;
        min-width: 28px;
        text-align: center;
      }
      .score-low {
        color: #dc3545;
      }
      .score-mid {
        color: #ffc107;
      }
      .score-high {
        color: #198754;
      }

      .timeline {
        position: relative;
        padding-left: 24px;
      }
      .timeline-item {
        position: relative;
      }
      .timeline-item::before {
        content: '';
        position: absolute;
        left: -18px;
        top: 10px;
        bottom: -10px;
        width: 2px;
        background: #dee2e6;
      }
      .timeline-item.timeline-last::before {
        display: none;
      }
      .timeline-dot {
        position: absolute;
        left: -22px;
        top: 8px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #0d6efd;
        border: 2px solid #fff;
        box-shadow: 0 0 0 2px #0d6efd;
      }
      .timeline-content {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
      }
    `,
  ],
})
class FollowupPageComponent implements OnInit, OnDestroy {
  private readonly store = inject(Store);
  private readonly followupApi = inject(FollowupApiService);
  private sub?: Subscription;

  protected readonly patientId = signal<string | null>(null);
  protected readonly surveys = signal<FollowupSurvey[]>([]);
  protected readonly schedules = signal<FollowupSchedule[]>([]);
  protected readonly loading = signal(false);
  protected readonly generatingSurvey = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly activeSurvey = signal<FollowupSurvey | null>(null);

  private answers = new Map<string, QuestionAnswer>();

  protected readonly pendingSurveys = () =>
    this.surveys().filter((s) => s.status !== 'COMPLETED');

  protected readonly completedSurveys = () =>
    this.surveys().filter((s) => s.status === 'COMPLETED');

  protected readonly riskDetected = () => {
    for (const [, a] of this.answers) {
      if (a.answerValue !== undefined && a.answerValue <= 1) return true;
    }
    return false;
  };

  ngOnInit(): void {
    this.sub = this.store.select(selectSelectedPatientId).subscribe((id) => {
      this.patientId.set(id);
      if (id) {
        this.loadSurveys(id);
        this.loadSchedules(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  protected openSurvey(survey: FollowupSurvey): void {
    this.activeSurvey.set(survey);
    this.answers.clear();
    for (const q of survey.questions) {
      this.answers.set(q.id, {
        questionId: q.id,
        answerText: '',
        answerValue: undefined,
      });
    }
  }

  protected closeSurvey(): void {
    this.activeSurvey.set(null);
    this.answers.clear();
  }

  protected getAnswer(questionId: string): QuestionAnswer | undefined {
    return this.answers.get(questionId);
  }

  protected setScaleAnswer(questionId: string, value: number): void {
    const a = this.answers.get(questionId);
    if (a) {
      a.answerValue = value;
      a.answerText = String(value);
    }
  }

  protected setTextAnswer(questionId: string, text: string): void {
    const a = this.answers.get(questionId);
    if (a) a.answerText = text;
  }

  protected submitSurvey(): void {
    const survey = this.activeSurvey();
    if (!survey) return;

    this.submitting.set(true);
    this.error.set(null);

    const answerList = Array.from(this.answers.values());

    this.followupApi.completeSurvey$(survey.id, answerList).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeSurvey();
        const pid = this.patientId();
        if (pid) this.loadSurveys(pid);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(
          err?.error?.message ?? 'Error al completar la encuesta'
        );
      },
    });
  }

  protected generateSurvey(): void {
    const pid = this.patientId();
    if (!pid) return;
    this.generatingSurvey.set(true);
    this.error.set(null);

    this.followupApi.generateSurvey$(pid, 'GENERAL', 'MANUAL').subscribe({
      next: () => {
        this.generatingSurvey.set(false);
        this.loadSurveys(pid);
      },
      error: (err) => {
        this.generatingSurvey.set(false);
        this.error.set(err?.error?.message ?? 'Error al generar encuesta');
      },
    });
  }

  protected scheduleBadge(status: string): string {
    switch (status) {
      case 'SCHEDULED':
        return 'text-bg-info';
      case 'COMPLETED':
        return 'text-bg-success';
      case 'OVERDUE':
        return 'text-bg-danger';
      case 'CANCELLED':
        return 'text-bg-secondary';
      default:
        return 'text-bg-secondary';
    }
  }

  private loadSurveys(patientId: string): void {
    this.loading.set(true);
    this.followupApi.getSurveys$(patientId).subscribe({
      next: (surveys) => {
        this.surveys.set(surveys);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadSchedules(patientId: string): void {
    this.followupApi.getSchedules$(patientId).subscribe({
      next: (schedules) => this.schedules.set(schedules),
      error: () => {},
    });
  }
}

export const FOLLOWUP_ROUTES: Routes = [
  { path: '', component: FollowupPageComponent },
];
