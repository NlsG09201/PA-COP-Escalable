import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectSelectedPatient } from '../../store/patients.selectors';
import { CommonModule } from '@angular/common';
import { AiAssistApiService, AiClinicalSuggestionVm } from '../../core/services/ai-assist-api.service';
import { AiSuggestionPanelComponent } from '../ai-assist/components/ai-suggestion-panel.component';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AiSuggestionPanelComponent],
  template: `
    <div class="row g-4">
      <div class="col-lg-8">
        <div class="card border-0 shadow-sm mb-4">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-4">
              <h5 class="card-title mb-0 d-flex align-items-center gap-2">
                <i class="bi bi-person-lines-fill text-primary"></i>
                Sesion Clinica Psicologica
              </h5>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                        (click)="analyzeWithAi()" [disabled]="!canAnalyze() || aiLoading()">
                  <i class="bi bi-stars" *ngIf="!aiLoading()"></i>
                  <span class="spinner-border spinner-border-sm" *ngIf="aiLoading()"></span>
                  {{ aiLoading() ? 'Analizando...' : 'Asistente IA' }}
                </button>
                <button type="submit" class="btn btn-primary btn-sm px-3 shadow-sm">Guardar Sesion</button>
              </div>
            </div>

            <form class="row g-3">
              <div class="col-md-12">
                <div class="context-banner p-3 rounded mb-3 d-flex justify-content-between align-items-center shadow-sm">
                  <div>
                    <small class="text-muted text-uppercase fw-bold" style="font-size: 0.65rem; letter-spacing: 0.05em;">Paciente en consulta</small>
                    <h6 class="mb-0 fw-bold">{{ (selectedPatient$ | async)?.name ?? 'Ninguno seleccionado' }}</h6>
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <span class="badge text-bg-soft-primary rounded-pill px-3">Activo</span>
                    <small class="text-muted">{{ (selectedPatient$ | async)?.document }}</small>
                  </div>
                </div>
              </div>

              <div class="col-md-12">
                <label class="form-label fw-semibold text-secondary small">OBJETIVO DE LA SESION</label>
                <input class="form-control form-control-lg border-0 bg-light shadow-none" 
                       [(ngModel)]="sessionGoal" name="goal" 
                       placeholder="Ej: Evaluacion de sintomatologia depresiva..." />
              </div>

              <div class="col-12">
                <label class="form-label fw-semibold text-secondary small">NOTAS CLINICAS DETALLADAS</label>
                <textarea class="form-control border-0 bg-light shadow-none" rows="15"
                          [(ngModel)]="clinicalNotes" name="notes"
                          style="resize: none;"
                          placeholder="Describe la conducta, discurso y observaciones del paciente..."></textarea>
                <div class="d-flex justify-content-between mt-2">
                  <small class="text-muted">{{ clinicalNotes.length }} caracteres</small>
                  <small class="text-info" *ngIf="!canAnalyze()">Minimo 20 caracteres para usar IA</small>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div class="col-lg-4">
        <div class="sticky-top" style="top: 1.5rem;">
          <app-ai-suggestion-panel
            [suggestion]="aiSuggestion()"
            [loading]="aiLoading()"
            (approved)="onAiApproved($event)"
            (rejected)="onAiRejected()">
          </app-ai-suggestion-panel>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .context-banner {
      background: #ffffff;
      border: 1px solid #f0f0f0;
    }
    .text-bg-soft-primary {
      background-color: #eef2ff;
      color: #4f46e5;
    }
    .form-control:focus {
      background-color: #f8fafc !important;
    }
  `]
})
class PsychologyPageComponent {
  private readonly store = inject(Store);
  private readonly aiApi = inject(AiAssistApiService);

  protected readonly selectedPatient$ = this.store.select(selectSelectedPatient);

  sessionGoal = '';
  clinicalNotes = '';

  aiSuggestion = signal<AiClinicalSuggestionVm | null>(null);
  aiLoading = signal(false);

  canAnalyze() {
    return this.clinicalNotes.trim().length >= 20;
  }

  analyzeWithAi() {
    this.selectedPatient$.subscribe(patient => {
      if (!patient) return;
      this.aiLoading.set(true);
      this.aiSuggestion.set(null);
      const context = `Objetivo: ${this.sessionGoal}\n\nNotas:\n${this.clinicalNotes}`;
      this.aiApi.analyzeContext$(patient.id, 'CLINICAL_INTERVIEW', context).subscribe({
        next: (res) => {
          this.aiSuggestion.set(res);
          this.aiLoading.set(false);
        },
        error: () => {
          this.aiLoading.set(false);
          // TODO: Add global toast for error
        }
      });
    }).unsubscribe();
  }

  onAiApproved(suggestion: AiClinicalSuggestionVm) {
    // Feedback logic here
  }

  onAiRejected() {
    this.aiSuggestion.set(null);
  }
}

export const PSYCHOLOGY_ROUTES: Routes = [{ path: '', component: PsychologyPageComponent }];
