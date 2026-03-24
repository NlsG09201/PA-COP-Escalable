import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectSelectedPatientId } from '../../store/patients.selectors';
import {
  CopilotApiService,
  CopilotSession,
  CopilotSuggestion
} from '../../core/services/copilot-api.service';

type SessionType = 'DENTAL_CONSULTATION' | 'PSYCHOLOGICAL_SESSION' | 'GENERAL';

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  DENTAL_CONSULTATION: 'Consulta Odontológica',
  PSYCHOLOGICAL_SESSION: 'Sesión Psicológica',
  GENERAL: 'Consulta General'
};

const SESSION_TYPE_ICONS: Record<SessionType, string> = {
  DENTAL_CONSULTATION: 'bi-emoji-smile',
  PSYCHOLOGICAL_SESSION: 'bi-brain',
  GENERAL: 'bi-clipboard2-pulse'
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container-fluid">
      @if (!patientId()) {
        <div class="alert alert-info d-flex align-items-center gap-2">
          <i class="bi bi-info-circle fs-5"></i>
          Selecciona un paciente para usar el Copiloto Clínico.
        </div>
      } @else {
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h4 class="mb-0 d-flex align-items-center gap-2">
            <i class="bi bi-robot text-primary"></i> Copiloto Clínico IA
          </h4>
          @if (!activeSession()) {
            <div class="dropdown">
              <button class="btn btn-primary dropdown-toggle d-flex align-items-center gap-1"
                      data-bs-toggle="dropdown" [disabled]="starting()">
                <span class="spinner-border spinner-border-sm" *ngIf="starting()"></span>
                <i class="bi bi-play-circle" *ngIf="!starting()"></i>
                Iniciar Sesión de Copiloto
              </button>
              <ul class="dropdown-menu dropdown-menu-end shadow">
                @for (type of sessionTypes; track type) {
                  <li>
                    <button class="dropdown-item d-flex align-items-center gap-2"
                            (click)="startSession(type)">
                      <i class="bi {{ getTypeIcon(type) }}"></i>
                      {{ getTypeLabel(type) }}
                    </button>
                  </li>
                }
              </ul>
            </div>
          }
        </div>

        <!-- Active session -->
        @if (activeSession()) {
          <div class="row g-3 mb-4">
            <!-- Context input -->
            <div class="col-lg-5">
              <div class="card border-0 shadow-sm h-100">
                <div class="card-header bg-white border-bottom-0 pt-3 d-flex justify-content-between align-items-center">
                  <h6 class="mb-0 d-flex align-items-center gap-2">
                    <i class="bi bi-pencil-square text-primary"></i>
                    Contexto Clínico
                  </h6>
                  <span class="badge bg-primary-subtle text-primary">
                    {{ getTypeLabel(activeSession()!.sessionType) }}
                  </span>
                </div>
                <div class="card-body d-flex flex-column">
                  <textarea class="form-control flex-grow-1 border-0 bg-light" rows="10"
                            [(ngModel)]="contextInput"
                            placeholder="Escribe las observaciones clínicas, síntomas reportados, hallazgos del examen...&#10;&#10;El copiloto IA generará sugerencias basadas en este contexto."
                            style="resize: none; min-height: 250px;"></textarea>
                  <div class="d-flex gap-2 mt-3">
                    <button class="btn btn-primary flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                            (click)="getSuggestion()" [disabled]="suggesting() || !contextInput.trim()">
                      <span class="spinner-border spinner-border-sm" *ngIf="suggesting()"></span>
                      <i class="bi bi-stars" *ngIf="!suggesting()"></i>
                      Obtener Sugerencia IA
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Suggestions panel -->
            <div class="col-lg-7">
              <div class="card border-0 shadow-sm h-100">
                <div class="card-header bg-white border-bottom-0 pt-3 d-flex justify-content-between align-items-center">
                  <h6 class="mb-0 d-flex align-items-center gap-2">
                    <i class="bi bi-lightbulb text-warning"></i>
                    Sugerencias del Copiloto
                  </h6>
                  <span class="badge bg-light text-dark">{{ suggestions().length }} sugerencias</span>
                </div>
                <div class="card-body suggestions-scroll" #suggestionsPanel>
                  @if (suggestions().length === 0 && !suggesting()) {
                    <div class="text-center text-muted py-5">
                      <i class="bi bi-chat-dots fs-1 d-block mb-3 opacity-25"></i>
                      <p>Ingresa contexto clínico y solicita sugerencias del copiloto IA</p>
                    </div>
                  }

                  @for (sug of suggestions(); track sug.timestamp) {
                    <div class="suggestion-card p-3 rounded-3 mb-3">
                      <div class="d-flex justify-content-between align-items-start mb-2">
                        <div class="d-flex align-items-center gap-2">
                          <i class="bi bi-robot text-primary"></i>
                          <small class="fw-semibold text-primary">Copiloto IA</small>
                        </div>
                        <small class="text-muted">{{ formatTime(sug.timestamp) }}</small>
                      </div>
                      <div class="suggestion-text">{{ sug.text }}</div>
                    </div>
                  }

                  <!-- Typing indicator -->
                  @if (suggesting()) {
                    <div class="suggestion-card p-3 rounded-3 mb-3">
                      <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-robot text-primary"></i>
                        <small class="fw-semibold text-primary">Copiloto IA</small>
                        <div class="typing-indicator ms-2">
                          <span></span><span></span><span></span>
                        </div>
                      </div>
                    </div>
                  }
                </div>

                <!-- Session controls -->
                <div class="card-footer bg-white border-top-0 pb-3 d-flex gap-2 justify-content-end">
                  <button class="btn btn-outline-info btn-sm d-flex align-items-center gap-1"
                          (click)="generateSummary()" [disabled]="generatingSummary()">
                    <span class="spinner-border spinner-border-sm" *ngIf="generatingSummary()"></span>
                    <i class="bi bi-file-earmark-text" *ngIf="!generatingSummary()"></i>
                    Generar Resumen
                  </button>
                  <button class="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
                          (click)="endSession()">
                    <i class="bi bi-stop-circle"></i>
                    Finalizar Sesión
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Summary display -->
          @if (summary()) {
            <div class="card border-0 shadow-sm mb-4 border-start border-info border-3">
              <div class="card-body">
                <h6 class="d-flex align-items-center gap-2 mb-3">
                  <i class="bi bi-file-earmark-medical text-info"></i>
                  Resumen Clínico de la Sesión
                </h6>
                <div class="summary-content p-3 rounded bg-light">
                  <pre class="mb-0" style="white-space: pre-wrap; font-family: inherit;">{{ summary() }}</pre>
                </div>
              </div>
            </div>
          }
        }

        <!-- Session history -->
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-white border-bottom-0 pt-3 d-flex justify-content-between align-items-center">
            <h6 class="mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-clock-history text-secondary"></i>
              Historial de Sesiones
            </h6>
            <button class="btn btn-link btn-sm" (click)="showHistory.set(!showHistory())">
              {{ showHistory() ? 'Ocultar' : 'Mostrar' }}
              <i class="bi" [class.bi-chevron-up]="showHistory()" [class.bi-chevron-down]="!showHistory()"></i>
            </button>
          </div>
          @if (showHistory()) {
            <div class="card-body pt-0">
              @if (historyLoading()) {
                <div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></div>
              } @else if (history().length === 0) {
                <p class="text-muted text-center py-3 mb-0">Sin sesiones previas</p>
              } @else {
                <div class="accordion" id="historyAccordion">
                  @for (sess of history(); track sess.id; let i = $index) {
                    <div class="accordion-item border-0 border-bottom">
                      <h2 class="accordion-header">
                        <button class="accordion-button collapsed py-2" type="button"
                                [attr.data-bs-toggle]="'collapse'"
                                [attr.data-bs-target]="'#hist-' + i">
                          <div class="d-flex align-items-center gap-3 w-100">
                            <i class="bi {{ getTypeIcon(sess.sessionType) }} text-primary"></i>
                            <div class="flex-grow-1">
                              <div class="fw-semibold small">{{ getTypeLabel(sess.sessionType) }}</div>
                              <small class="text-muted">{{ sess.startedAt | date:'medium' }}</small>
                            </div>
                            <span class="badge" [class]="sess.status === 'ENDED' ? 'bg-success' : 'bg-warning'">
                              {{ sess.status }}
                            </span>
                          </div>
                        </button>
                      </h2>
                      <div [id]="'hist-' + i" class="accordion-collapse collapse">
                        <div class="accordion-body">
                          @if (sess.summaryText) {
                            <div class="p-3 bg-light rounded">
                              <pre class="mb-0" style="white-space: pre-wrap; font-family: inherit;">{{ sess.summaryText }}</pre>
                            </div>
                          } @else {
                            <p class="text-muted mb-0">Sin resumen generado.</p>
                          }
                          @if (sess.suggestions?.length) {
                            <hr>
                            <p class="small text-muted fw-semibold mb-2">{{ sess.suggestions.length }} sugerencias generadas</p>
                            @for (sug of sess.suggestions.slice(0, 3); track sug.timestamp) {
                              <div class="small text-muted mb-1">• {{ sug.text | slice:0:120 }}...</div>
                            }
                          }
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .suggestions-scroll { max-height: 450px; overflow-y: auto; }
    .suggestion-card {
      background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
      border: 1px solid #e8ecf4;
    }
    .suggestion-text { line-height: 1.6; color: #374151; }
    .typing-indicator {
      display: flex; gap: 4px; align-items: center;
    }
    .typing-indicator span {
      width: 6px; height: 6px; border-radius: 50%; background: #667eea;
      animation: typing 1.4s infinite ease-in-out;
    }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }
    .summary-content pre { font-size: 0.9rem; line-height: 1.7; color: #1f2937; }
    .accordion-button:not(.collapsed) { background: #f8f9fa; box-shadow: none; }
  `]
})
class CopilotPageComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly api = inject(CopilotApiService);

  @ViewChild('suggestionsPanel') suggestionsPanel?: ElementRef<HTMLDivElement>;

  readonly patientId = signal<string | null>(null);
  readonly activeSession = signal<CopilotSession | null>(null);
  readonly suggestions = signal<CopilotSuggestion[]>([]);
  readonly summary = signal<string | null>(null);
  readonly history = signal<CopilotSession[]>([]);
  readonly showHistory = signal(true);
  readonly starting = signal(false);
  readonly suggesting = signal(false);
  readonly generatingSummary = signal(false);
  readonly historyLoading = signal(false);

  readonly sessionTypes: SessionType[] = ['DENTAL_CONSULTATION', 'PSYCHOLOGICAL_SESSION', 'GENERAL'];
  contextInput = '';

  ngOnInit() {
    this.store.select(selectSelectedPatientId).subscribe(id => {
      this.patientId.set(id ?? null);
      if (id) this.loadHistory(id);
    });
  }

  getTypeLabel(type: string): string {
    return SESSION_TYPE_LABELS[type as SessionType] ?? type;
  }

  getTypeIcon(type: string): string {
    return SESSION_TYPE_ICONS[type as SessionType] ?? 'bi-chat';
  }

  startSession(type: SessionType) {
    const pid = this.patientId();
    if (!pid) return;
    this.starting.set(true);
    this.api.startSession$(pid, type).subscribe({
      next: session => {
        this.activeSession.set(session);
        this.suggestions.set(session.suggestions ?? []);
        this.summary.set(null);
        this.contextInput = '';
        this.starting.set(false);
      },
      error: () => this.starting.set(false)
    });
  }

  getSuggestion() {
    const session = this.activeSession();
    if (!session || !this.contextInput.trim()) return;
    this.suggesting.set(true);
    this.api.generateSuggestion$(session.id, this.contextInput).subscribe({
      next: sug => {
        this.suggestions.set([...this.suggestions(), sug]);
        this.suggesting.set(false);
        setTimeout(() => this.scrollToBottom(), 50);
      },
      error: () => this.suggesting.set(false)
    });
  }

  generateSummary() {
    const session = this.activeSession();
    if (!session) return;
    this.generatingSummary.set(true);
    this.api.generateSummary$(session.id).subscribe({
      next: updated => {
        this.summary.set(updated.summaryText ?? null);
        this.generatingSummary.set(false);
      },
      error: () => this.generatingSummary.set(false)
    });
  }

  endSession() {
    const session = this.activeSession();
    if (!session) return;
    this.api.endSession$(session.id).subscribe({
      next: () => {
        this.activeSession.set(null);
        this.suggestions.set([]);
        this.summary.set(null);
        this.contextInput = '';
        const pid = this.patientId();
        if (pid) this.loadHistory(pid);
      }
    });
  }

  formatTime(ts: string): string {
    return new Date(ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  private loadHistory(patientId: string) {
    this.historyLoading.set(true);
    this.api.getHistory$(patientId).subscribe({
      next: h => { this.history.set(h); this.historyLoading.set(false); },
      error: () => this.historyLoading.set(false)
    });
  }

  private scrollToBottom() {
    const el = this.suggestionsPanel?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}

export const COPILOT_ROUTES: Routes = [{ path: '', component: CopilotPageComponent }];
