import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes } from '@angular/router';
import {
  ArffDatasetSchema,
  ClinicalPrediction,
  WekaDashboard,
  WekaLabApiService,
  WekaModelRow,
} from '../../core/services/weka-lab-api.service';
import { extractHttpErrorMessage } from '../../core/http/extract-http-error-message';
import { WekaClinicalPredictComponent } from './weka-clinical-predict.component';

const DEFAULT_SCHEMA: ArffDatasetSchema = {
  id: 'builtin-arff',
  filename: 'relapse_risk_j48.arff',
  displayName: 'Riesgo de recaída (J48 / ARFF COP)',
  rows: 15000,
  target: 'risk_level',
  classLabels: ['LOW', 'MEDIUM', 'HIGH'],
  features: [
    { key: 'gender', label: 'Género', type: 'nominal', options: ['M', 'F', 'O'] },
    { key: 'age_group', label: 'Grupo de edad', type: 'nominal', options: ['YOUNG_ADULT', 'ADULT', 'SENIOR'] },
    { key: 'sentiment', label: 'Sentimiento', type: 'nominal', options: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] },
    { key: 'wellbeing', label: 'Bienestar', type: 'nominal', options: ['HIGH', 'MEDIUM', 'LOW'] },
    { key: 'anxiety', label: 'Ansiedad', type: 'numeric', min: 0, max: 1 },
    { key: 'depression', label: 'Depresión', type: 'numeric', min: 0, max: 1 },
    { key: 'attendance', label: 'Asistencia', type: 'nominal', options: ['REGULAR', 'IRREGULAR'] },
    { key: 'days_since_last', label: 'Días sin sesión', type: 'numeric', min: 0, max: 90 },
  ],
};

@Component({
  standalone: true,
  imports: [CommonModule, WekaClinicalPredictComponent],
  template: `
    <div class="weka-lab-page">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <h4 class="mb-1">Weka AI Lab</h4>
          <p class="text-muted mb-0 small">
            Modelo J48 entrenado con <strong>{{ schema().filename }}</strong> — predicción de
            <code>{{ schema().target }}</code> ({{ schema().classLabels.join(', ') }}).
          </p>
        </div>
        @if (dash()?.j48LabOnline) {
          <span class="badge text-bg-success">Motor J48 en línea</span>
        } @else {
          <span class="badge text-bg-secondary">ARFF integrado (offline / heurística)</span>
        }
      </div>

      @if (dash()?.message) {
        <div class="alert alert-warning py-2 small">{{ dash()!.message }}</div>
      }
      @if (error()) {
        <div class="alert alert-danger py-2">{{ error() }}</div>
      }

      @if (loading()) {
        <div class="text-center py-5">
          <div class="spinner-border text-primary" role="status"></div>
        </div>
      } @else {
        <div class="card border-0 shadow-sm mb-4">
          <div class="card-body">
            <h5 class="h6 mb-3">Dataset conectado</h5>
            <div class="row g-3">
              <div class="col-md-3">
                <div class="text-muted small">Archivo</div>
                <div class="fw-semibold">{{ schema().filename }}</div>
              </div>
              <div class="col-md-2">
                <div class="text-muted small">Registros</div>
                <div class="fw-semibold">{{ schema().rows | number }}</div>
              </div>
              <div class="col-md-2">
                <div class="text-muted small">Variables</div>
                <div class="fw-semibold">{{ schema().features.length }}</div>
              </div>
              <div class="col-md-5">
                <div class="text-muted small">Atributos (ARFF)</div>
                <div class="small font-monospace text-break">
                  {{ arffAttributeLine() }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="row g-3 mb-4">
          <div class="col-md-4">
            <div class="card border-0 shadow-sm h-100">
              <div class="card-body">
                <div class="text-muted small">Modelos</div>
                <div class="fs-3 fw-semibold">{{ dash()?.orgModelsCount ?? 0 }}</div>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card border-0 shadow-sm h-100">
              <div class="card-body">
                <div class="text-muted small">Datasets</div>
                <div class="fs-3 fw-semibold">{{ dash()?.orgDatasetsCount ?? 0 }}</div>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card border-0 shadow-sm h-100">
              <div class="card-body">
                <div class="text-muted small">Predicciones guardadas</div>
                <div class="fs-3 fw-semibold">{{ dash()?.orgPredictionsCount ?? 0 }}</div>
              </div>
            </div>
          </div>
        </div>

        @if (dash()?.orgActiveModel; as active) {
          <div class="alert alert-success py-2 mb-4">
            Modelo activo: <strong>{{ active.name }}</strong>
            @if (active.metrics?.['f1'] != null) {
              · F1 {{ active.metrics!['f1'] | number: '1.2-2' }}
            }
          </div>
        }

        <app-weka-clinical-predict [schema]="schema()" [models]="models()" (predicted)="onPredicted($event)" />

        <h5 class="h6 mt-4 mb-2">Modelos en catálogo</h5>
        <div class="table-responsive card border-0 shadow-sm">
          <table class="table table-sm table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Versión</th>
                <th>F1</th>
                <th>Activo</th>
              </tr>
            </thead>
            <tbody>
              @for (m of models(); track m.id) {
                <tr>
                  <td>{{ m.name }}</td>
                  <td>{{ m.version ?? '—' }}</td>
                  <td>{{ m.metrics?.['f1'] != null ? (m.metrics!['f1'] | number: '1.2-2') : '—' }}</td>
                  <td>
                    @if (m.isActive) {
                      <span class="badge text-bg-success">Sí</span>
                    } @else {
                      <span class="badge text-bg-secondary">No</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="text-muted text-center py-3">Sin modelos adicionales; se usa el ARFF integrado.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: `
    .weka-lab-page {
      max-width: 1200px;
    }
  `,
})
class WekaLabPageComponent {
  private readonly api = inject(WekaLabApiService);

  private static readonly OFFLINE_MODELS: WekaModelRow[] = [
    {
      id: 'builtin-arff-model',
      name: 'J48 recaída (ARFF integrado)',
      version: '1.0.0',
      isActive: true,
      metrics: { note: 'Dataset relapse_risk_j48.arff' },
    },
  ];

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly dash = signal<WekaDashboard | null>(null);
  protected readonly schema = signal<ArffDatasetSchema>(DEFAULT_SCHEMA);
  protected readonly models = signal<WekaModelRow[]>(WekaLabPageComponent.OFFLINE_MODELS);

  constructor() {
    this.api.dashboard$().subscribe({
      next: (d) => {
        this.dash.set(d);
        if (d.datasetSchema) {
          this.schema.set(d.datasetSchema);
        } else if (d.builtinDataset) {
          this.schema.set({
            id: d.builtinDataset.id,
            filename: d.builtinDataset.filename,
            displayName: d.builtinDataset.displayName,
            rows: d.builtinDataset.rows,
            target: d.builtinDataset.target ?? 'risk_level',
            classLabels: d.builtinDataset.classLabels ?? ['LOW', 'MEDIUM', 'HIGH'],
            features: d.builtinDataset.features ?? DEFAULT_SCHEMA.features,
          });
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const status = (err as { status?: number })?.status;
        if (status === 503 || status === 502 || status === 0) {
          this.dash.set({
            orgModelsCount: 1,
            orgDatasetsCount: 1,
            orgPredictionsCount: 0,
            j48LabOnline: false,
            orgActiveModel: WekaLabPageComponent.OFFLINE_MODELS[0],
            message:
              'Motor J48 Python no disponible. El formulario sigue operativo con el modelo ARFF integrado.',
          });
          this.models.set(WekaLabPageComponent.OFFLINE_MODELS);
          return;
        }
        this.error.set(extractHttpErrorMessage(err, 'No se pudo cargar Weka Lab.'));
      },
    });

    this.api.models$().subscribe({
      next: (rows) => {
        const list = rows?.length ? rows : WekaLabPageComponent.OFFLINE_MODELS;
        const hasBuiltin = list.some((m) => m.id === 'builtin-arff-model');
        this.models.set(hasBuiltin ? list : [...WekaLabPageComponent.OFFLINE_MODELS, ...list]);
      },
      error: () => this.models.set(WekaLabPageComponent.OFFLINE_MODELS),
    });

    this.api.datasetSchema$().subscribe({
      next: (s) => this.schema.set(s),
      error: () => {},
    });
  }

  protected arffAttributeLine(): string {
    const s = this.schema();
    const attrs = s.features.map((f) => f.key).join(', ');
    return `@ATTRIBUTE … ${attrs} · @ATTRIBUTE ${s.target} {${s.classLabels.join(', ')}}`;
  }

  protected onPredicted(_event: ClinicalPrediction): void {
    const d = this.dash();
    if (d) {
      this.dash.set({
        ...d,
        orgPredictionsCount: (d.orgPredictionsCount ?? 0) + 1,
      });
    }
  }
}

export const WEKA_LAB_ROUTES: Routes = [{ path: '', component: WekaLabPageComponent }];
