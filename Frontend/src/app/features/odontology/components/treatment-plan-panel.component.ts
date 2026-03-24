import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { TreatmentPlanVm } from 'src/app/core/services/odontology-api.service';

@Component({
  selector: 'app-treatment-plan-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card border-0 shadow-sm overflow-hidden">
      <div class="card-header bg-white border-bottom-0 pt-3 pb-0 d-flex justify-content-between align-items-center">
        <h6 class="card-title text-primary mb-0 fw-bold">Planes de Tratamiento (Sugerido por IA)</h6>
        <button class="btn btn-sm btn-outline-primary" (click)="onSuggest()" [disabled]="loading()">
          <i class="bi bi-magic me-1"></i> Sugerir Plan
        </button>
      </div>
      <div class="card-body">
        @if (loading()) {
          <div class="text-center py-4">
            <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
            <p class="small text-muted mt-2">Generando plan basado en protocolos...</p>
          </div>
        } @else if (plans().length === 0) {
          <div class="alert alert-light border-dashed text-center py-4">
            <i class="bi bi-clipboard2-plus text-muted h3 d-block mb-2"></i>
            <p class="small text-muted mb-0">No hay planes registrados. Haz clic en "Sugerir Plan" para iniciar.</p>
          </div>
        } @else {
          <div class="plans-accordion mt-2">
            @for (plan of plans(); track plan.id) {
              <div class="plan-card mb-3 p-3 border rounded-3 bg-light">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <span class="badge text-bg-primary rounded-pill small">{{ plan.status }}</span>
                  <small class="text-muted">{{ plan.createdAt | date:'shortDate' }}</small>
                </div>
                <h6 class="mb-2 fw-bold small">{{ plan.name }}</h6>
                
                <div class="steps-list mt-2">
                  @for (step of plan.steps; track step.description) {
                    <div class="step-item d-flex align-items-start gap-2 mb-2 p-2 bg-white rounded border-start border-primary border-4">
                      <div class="tooth-badge bg-soft-primary text-primary px-2 py-1 rounded small fw-bold">
                        {{ step.toothCode }}
                      </div>
                      <div class="flex-grow-1">
                        <p class="mb-0 small fw-semibold line-clamp-2">{{ step.description }}</p>
                        <small class="text-muted d-block mt-1">Estimado: {{ step.estimatedCost | currency }}</small>
                      </div>
                    </div>
                  }
                </div>
                
                <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                  <span class="small fw-bold">Total Estimado:</span>
                  <span class="text-primary fw-bold">{{ getTotal(plan) | currency }}</span>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .border-dashed { border-style: dashed !important; }
    .bg-soft-primary { background-color: #eef2ff; }
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .plan-card {
      transition: all 0.2s ease;
      cursor: default;
    }
    .plan-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      border-color: #4f46e5 !important;
    }
    .step-item {
      font-size: 0.85rem;
    }
    .tooth-badge {
      min-width: 32px;
      text-align: center;
    }
  `]
})
export class TreatmentPlanPanelComponent {
  @Input() plans = signal<TreatmentPlanVm[]>([]);
  @Input() loading = signal(false);
  @Output() suggest = new EventEmitter<void>();

  onSuggest() {
    this.suggest.emit();
  }

  getTotal(plan: TreatmentPlanVm): number {
    return plan.steps.reduce((acc, step) => acc + step.estimatedCost, 0);
  }
}
