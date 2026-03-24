import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';
import { selectSelectedPatientId } from '../../store/patients.selectors';
import {
  DiagnosisApiService,
  DiagnosisResult,
  Finding,
} from '../../core/services/diagnosis-api.service';

const FINDING_COLORS: Record<string, string> = {
  CARIES: '#dc3545',
  INFECTION: '#fd7e14',
  WEAR: '#ffc107',
  FRACTURE: '#dc3545',
  PERIAPICAL_LESION: '#6f42c1',
  HEALTHY: '#198754',
};

function findingColor(label: string): string {
  const key = label.toUpperCase().replace(/\s+/g, '_');
  return FINDING_COLORS[key] ?? '#6c757d';
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid py-3">
      <!-- Header -->
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h4 class="mb-0 fw-bold">
          <i class="bi bi-search me-2 text-primary"></i>Diagnostico por Imagen
        </h4>
        @if (!patientId()) {
          <span class="badge text-bg-warning">Seleccione un paciente</span>
        }
      </div>

      @if (!patientId()) {
        <div class="alert alert-info d-flex align-items-center gap-2">
          <i class="bi bi-info-circle"></i>
          Seleccione un paciente desde el listado para comenzar el diagnostico.
        </div>
      } @else {
        <div class="row g-4">
          <!-- Upload Section -->
          <div class="col-lg-5">
            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <h6 class="card-title mb-3">Subir Imagen</h6>

                <!-- Drop Zone -->
                <div
                  class="drop-zone rounded-3 text-center p-5 mb-3"
                  [class.drop-zone--over]="isDragOver()"
                  (dragover)="onDragOver($event)"
                  (dragleave)="onDragLeave()"
                  (drop)="onDrop($event)"
                  (click)="fileInput.click()"
                >
                  @if (!previewUrl()) {
                    <i class="bi bi-cloud-arrow-up display-4 text-muted"></i>
                    <p class="text-muted mt-2 mb-0">
                      Arrastre una imagen aqui o haga clic para seleccionar
                    </p>
                    <small class="text-muted">PNG, JPG, DICOM</small>
                  } @else {
                    <img
                      [src]="previewUrl()"
                      alt="Preview"
                      class="img-fluid rounded"
                      style="max-height: 280px; object-fit: contain"
                    />
                  }
                </div>

                <input
                  #fileInput
                  type="file"
                  class="d-none"
                  accept="image/*"
                  (change)="onFileSelected($event)"
                />

                @if (selectedFile()) {
                  <div class="d-flex align-items-center justify-content-between mb-3">
                    <small class="text-muted text-truncate me-2">
                      {{ selectedFile()!.name }}
                    </small>
                    <button
                      class="btn btn-sm btn-outline-danger"
                      (click)="clearFile()"
                    >
                      <i class="bi bi-x-lg"></i>
                    </button>
                  </div>
                }

                <button
                  class="btn btn-primary w-100"
                  [disabled]="!selectedFile() || analyzing()"
                  (click)="analyze()"
                >
                  @if (analyzing()) {
                    <span
                      class="spinner-border spinner-border-sm me-2"
                    ></span>
                    Analizando...
                  } @else {
                    <i class="bi bi-cpu me-2"></i>Analizar Imagen
                  }
                </button>

                @if (error()) {
                  <div class="alert alert-danger mt-3 mb-0 small">
                    {{ error() }}
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Results Section -->
          <div class="col-lg-7">
            @if (currentResult()) {
              <div class="card border-0 shadow-sm mb-4">
                <div class="card-body">
                  <div
                    class="d-flex justify-content-between align-items-center mb-3"
                  >
                    <h6 class="card-title mb-0">Resultados del Analisis</h6>
                    <small class="text-muted">
                      {{ currentResult()!.processingTimeMs }}ms •
                      {{ currentResult()!.modelVersion }}
                    </small>
                  </div>

                  @for (
                    finding of currentResult()!.findings;
                    track finding.label
                  ) {
                    <div class="finding-card mb-3 p-3 rounded-3">
                      <div
                        class="d-flex justify-content-between align-items-center mb-2"
                      >
                        <div class="d-flex align-items-center gap-2">
                          <span
                            class="finding-dot"
                            [style.background]="colorFor(finding.label)"
                          ></span>
                          <strong>{{ finding.label }}</strong>
                        </div>
                        <span class="badge rounded-pill text-bg-dark">
                          {{ (finding.confidence * 100).toFixed(1) }}%
                        </span>
                      </div>
                      <div class="progress mb-2" style="height: 6px">
                        <div
                          class="progress-bar"
                          role="progressbar"
                          [style.width.%]="finding.confidence * 100"
                          [style.background]="colorFor(finding.label)"
                        ></div>
                      </div>
                      <small class="text-muted">{{
                        finding.description
                      }}</small>
                    </div>
                  } @empty {
                    <p class="text-muted text-center py-3">
                      No se detectaron hallazgos.
                    </p>
                  }
                </div>
              </div>
            } @else if (!analyzing()) {
              <div
                class="card border-0 shadow-sm d-flex align-items-center justify-content-center"
                style="min-height: 300px"
              >
                <div class="text-center text-muted">
                  <i class="bi bi-image display-4"></i>
                  <p class="mt-2">
                    Suba una imagen y presione "Analizar" para ver resultados
                  </p>
                </div>
              </div>
            }

            <!-- History -->
            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <h6 class="card-title mb-3">
                  <i class="bi bi-clock-history me-2"></i>Historial de
                  Diagnosticos
                </h6>

                @if (historyLoading()) {
                  <div class="text-center py-4">
                    <div class="spinner-border text-primary"></div>
                  </div>
                } @else if (history().length === 0) {
                  <p class="text-muted text-center py-3">
                    No hay diagnosticos previos.
                  </p>
                } @else {
                  @for (result of history(); track result.id) {
                    <div
                      class="history-item d-flex justify-content-between align-items-center p-3 rounded-3 mb-2"
                      [class.active]="
                        currentResult() && currentResult()!.id === result.id
                      "
                      (click)="selectHistoryItem(result)"
                      role="button"
                    >
                      <div>
                        <div class="fw-semibold small">
                          {{ result.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                        </div>
                        <small class="text-muted">
                          {{ topFinding(result) }}
                        </small>
                      </div>
                      <div class="d-flex align-items-center gap-2">
                        <span
                          class="badge rounded-pill"
                          [class]="statusBadge(result.status)"
                        >
                          {{ result.status }}
                        </span>
                        <span class="badge text-bg-secondary rounded-pill">
                          {{ result.findings.length }} hallazgos
                        </span>
                      </div>
                    </div>
                  }
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
      .drop-zone {
        border: 2px dashed #dee2e6;
        cursor: pointer;
        transition: all 0.2s;
        background: #fafbfc;
      }
      .drop-zone:hover,
      .drop-zone--over {
        border-color: #0d6efd;
        background: #e8f0fe;
      }
      .finding-card {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
      }
      .finding-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        display: inline-block;
      }
      .history-item {
        background: #f8f9fa;
        border: 1px solid transparent;
        transition: all 0.15s;
      }
      .history-item:hover {
        background: #e9ecef;
      }
      .history-item.active {
        border-color: #0d6efd;
        background: #e8f0fe;
      }
    `,
  ],
})
class DiagnosisPageComponent implements OnInit, OnDestroy {
  private readonly store = inject(Store);
  private readonly diagnosisApi = inject(DiagnosisApiService);
  private sub?: Subscription;

  protected readonly patientId = signal<string | null>(null);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly analyzing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly currentResult = signal<DiagnosisResult | null>(null);
  protected readonly history = signal<DiagnosisResult[]>([]);
  protected readonly historyLoading = signal(false);
  protected readonly isDragOver = signal(false);

  ngOnInit(): void {
    this.sub = this.store.select(selectSelectedPatientId).subscribe((id) => {
      this.patientId.set(id);
      if (id) this.loadHistory(id);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  protected onDragLeave(): void {
    this.isDragOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) this.setFile(file);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.setFile(file);
    input.value = '';
  }

  protected clearFile(): void {
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!);
    this.selectedFile.set(null);
    this.previewUrl.set(null);
    this.error.set(null);
  }

  protected analyze(): void {
    const pid = this.patientId();
    const file = this.selectedFile();
    if (!pid || !file) return;

    this.analyzing.set(true);
    this.error.set(null);
    this.currentResult.set(null);

    this.diagnosisApi.analyzeImage$(pid, file).subscribe({
      next: (result) => {
        this.currentResult.set(result);
        this.analyzing.set(false);
        this.loadHistory(pid);
      },
      error: (err) => {
        this.error.set(
          err?.error?.message ?? 'Error al analizar la imagen. Intente nuevamente.'
        );
        this.analyzing.set(false);
      },
    });
  }

  protected selectHistoryItem(result: DiagnosisResult): void {
    this.currentResult.set(result);
  }

  protected colorFor(label: string): string {
    return findingColor(label);
  }

  protected topFinding(result: DiagnosisResult): string {
    if (!result.findings.length) return 'Sin hallazgos';
    const top = result.findings.reduce((a, b) =>
      a.confidence > b.confidence ? a : b
    );
    return `${top.label} (${(top.confidence * 100).toFixed(0)}%)`;
  }

  protected statusBadge(status: string): string {
    switch (status) {
      case 'COMPLETED':
        return 'text-bg-success';
      case 'PROCESSING':
        return 'text-bg-warning';
      case 'FAILED':
        return 'text-bg-danger';
      default:
        return 'text-bg-secondary';
    }
  }

  private setFile(file: File): void {
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!);
    this.selectedFile.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
    this.error.set(null);
  }

  private loadHistory(patientId: string): void {
    this.historyLoading.set(true);
    this.diagnosisApi.getResults$(patientId).subscribe({
      next: (results) => {
        this.history.set(results);
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false),
    });
  }
}

export const DIAGNOSIS_ROUTES: Routes = [
  { path: '', component: DiagnosisPageComponent },
];
