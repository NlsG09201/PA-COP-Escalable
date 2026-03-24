import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, Output, computed, signal } from '@angular/core';
import { AiAssistApiService, AiClinicalSuggestionVm, AiStructuredOutput } from '../../../core/services/ai-assist-api.service';

@Component({
  selector: 'app-ai-suggestion-panel',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card border-0 shadow-sm overflow-hidden" *ngIf="suggestion()">
      <div class="card-header bg-white border-bottom-0 py-3">
        <div class="d-flex justify-content-between align-items-center">
          <h6 class="mb-0 fw-bold d-flex align-items-center gap-2">
            <span class="pulse-dot" *ngIf="suggestion()?.status === 'PROCESSING'"></span>
            Asistente Clinico IA
          </h6>
          <span class="badge" [ngClass]="riskBadgeClass()">
            Riesgo: {{ (output()?.risk_level ?? 'unknown') | uppercase }}
          </span>
        </div>
      </div>

      <div class="card-body pt-0 scrollable-content" style="max-height: 600px; overflow-y: auto;">
        <div class="alert alert-warning small py-2 mb-3 border-0">
          <i class="bi bi-info-circle me-2"></i>
          {{ output()?.disclaimer }}
        </div>

        <!-- Hipotesis Diagnosticas -->
        <section class="mb-4" *ngIf="output()?.candidate_conditions?.length">
          <p class="section-title">Hipotesis Sugeridas</p>
          <div class="d-grid gap-2">
            @for (cond of output()?.candidate_conditions; track cond.label) {
              <div class="condition-card p-2 rounded">
                <div class="d-flex justify-content-between align-items-start">
                  <span class="fw-semibold">{{ cond.label }}</span>
                  <small class="text-muted">{{ cond.confidence_0_to_1 * 100 | number: '1.0-0' }}% conf.</small>
                </div>
                <p class="small text-muted mb-0 mt-1">{{ cond.rationale }}</p>
              </div>
            }
          </div>
        </section>

        <!-- Senales de Apoyo -->
        <section class="mb-4" *ngIf="output()?.supporting_signals?.length">
          <p class="section-title">Senales Identificadas</p>
          <ul class="list-unstyled small mb-0">
            @for (signal of output()?.supporting_signals; track signal) {
              <li class="d-flex gap-2 mb-1">
                <i class="bi bi-check2-circle text-primary"></i>
                <span>{{ signal }}</span>
              </li>
            }
          </ul>
        </section>

        <!-- Recomendaciones de Entrevista -->
        <section class="mb-4" *ngIf="output()?.recommended_clarifying_questions?.length">
          <p class="section-title text-info">Preguntas Recomendadas</p>
          <div class="bg-light p-2 rounded">
            <ul class="list-unstyled small mb-0">
              @for (q of output()?.recommended_clarifying_questions; track q) {
                <li class="mb-2 italic">"{{ q }}"</li>
              }
            </ul>
          </div>
        </section>

        <!-- Acciones Sugeridas -->
        <section class="mb-4" *ngIf="output()?.recommended_non_diagnostic_actions?.length">
          <p class="section-title text-success">Acciones no Diagnosticas</p>
          <ul class="small mb-0">
            @for (action of output()?.recommended_non_diagnostic_actions; track action) {
              <li class="mb-1">{{ action }}</li>
            }
          </ul>
        </section>

        <!-- Evidencia -->
        <section class="mb-3" *ngIf="output()?.evidence_quotes_from_input?.length">
          <p class="section-title text-muted">Evidencia Textual (Citas)</p>
          @for (quote of output()?.evidence_quotes_from_input; track quote) {
            <blockquote class="blockquote-footer mt-1 mb-2 px-2 border-start border-3">
              {{ quote }}
            </blockquote>
          }
        </section>
      </div>

      <div class="card-footer bg-light border-top-0 d-flex gap-2" *ngIf="suggestion()?.status === 'PENDING_REVIEW'">
        <button class="btn btn-outline-danger btn-sm flex-fill" (click)="onReject()" [disabled]="loading()">
          Descartar
        </button>
        <button class="btn btn-primary btn-sm flex-fill shadow-sm" (click)="onApprove()" [disabled]="loading()">
          Incorporar a Historia
        </button>
      </div>

      <div class="card-footer bg-white border-top-0 text-center" *ngIf="suggestion()?.status === 'APPROVED'">
        <span class="text-success small fw-bold">
          <i class="bi bi-check-all me-1"></i> Aprobado e incorporado
        </span>
      </div>
    </div>

    <div class="card border-0 shadow-sm bg-light text-center py-5" *ngIf="!suggestion() && !loading()">
      <div class="card-body">
        <i class="bi bi-robot h1 text-muted"></i>
        <p class="text-muted small mt-2">No hay analisis activo para este paciente.<br>Ingresa notas para iniciar.</p>
      </div>
    </div>

    <div class="text-center py-4" *ngIf="loading()">
      <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
      <p class="text-muted small mt-2">Analizando contexto clinico...</p>
    </div>
  `,
  styles: [`
    .section-title {
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
      color: #4a5568;
    }
    .condition-card {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
    }
    .scrollable-content::-webkit-scrollbar {
      width: 4px;
    }
    .scrollable-content::-webkit-scrollbar-thumb {
      background: #cbd5e0;
      border-radius: 10px;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      background: #4299e1;
      border-radius: 50%;
      display: inline-block;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(66, 153, 225, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(66, 153, 225, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(66, 153, 225, 0); }
    }
    .italic { font-style: italic; }
  `]
})
export class AiSuggestionPanelComponent {
  private readonly aiApi = inject(AiAssistApiService);

  suggestion = signal<AiClinicalSuggestionVm | null>(null);
  loading = signal(false);

  @Input('suggestion') set setSuggestion(val: AiClinicalSuggestionVm | null) {
    this.suggestion.set(val);
  }

  @Input('loading') set setLoading(val: boolean) {
    this.loading.set(val);
  }

  @Output() approved = new EventEmitter<AiClinicalSuggestionVm>();
  @Output() rejected = new EventEmitter<void>();

  output = computed(() => {
    const s = this.suggestion();
    return s ? this.aiApi.parseStructuredOutput(s) : null;
  });

  riskBadgeClass() {
    const level = this.output()?.risk_level;
    if (level === 'critical') return 'text-bg-danger shadow-sm';
    if (level === 'high') return 'text-bg-warning text-dark shadow-sm';
    if (level === 'medium') return 'text-bg-info text-white shadow-sm';
    return 'text-bg-success shadow-sm';
  }

  onApprove() {
    const s = this.suggestion();
    if (!s) return;
    this.loading.set(true);
    this.aiApi.approve$(s.id).subscribe({
      next: (res: AiClinicalSuggestionVm) => {
        this.suggestion.set(res);
        this.loading.set(false);
        this.approved.emit(res);
      },
      error: () => this.loading.set(false)
    });
  }

  onReject() {
    const s = this.suggestion();
    if (!s) {
      this.rejected.emit();
      return;
    }
    this.loading.set(true);
    this.aiApi.reject$(s.id).subscribe({
      next: (_res: AiClinicalSuggestionVm) => {
        this.suggestion.set(null);
        this.loading.set(false);
        this.rejected.emit();
      },
      error: () => {
        this.loading.set(false);
        this.suggestion.set(null);
        this.rejected.emit();
      }
    });
  }
}
