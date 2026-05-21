import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes } from '@angular/router';
import { WekaLabApiService } from '../../core/services/weka-lab-api.service';
import { extractHttpErrorMessage } from '../../core/http/extract-http-error-message';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <h4 class="card-title">Weka AI Lab</h4>
        <p class="text-muted">
          Entrenamiento J48, comparación de modelos y predicción clínica integrada con el motor Python en Render.
        </p>

        @if (error()) {
          <div class="alert alert-danger py-2">{{ error() }}</div>
        }

        @if (loading()) {
          <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status"></div>
          </div>
        } @else if (dash()) {
          <div class="row g-3 mb-4">
            <div class="col-md-4">
              <div class="border rounded p-3 h-100">
                <div class="text-muted small">Modelos</div>
                <div class="fs-3 fw-semibold">{{ dash()!.orgModelsCount ?? 0 }}</div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="border rounded p-3 h-100">
                <div class="text-muted small">Datasets</div>
                <div class="fs-3 fw-semibold">{{ dash()!.orgDatasetsCount ?? 0 }}</div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="border rounded p-3 h-100">
                <div class="text-muted small">Predicciones</div>
                <div class="fs-3 fw-semibold">{{ dash()!.orgPredictionsCount ?? 0 }}</div>
              </div>
            </div>
          </div>

          @if (dash()!.orgActiveModel; as active) {
            <div class="alert alert-success py-2">
              Modelo activo: <strong>{{ active.name }}</strong>
              @if (active.metrics?.f1 != null) {
                · F1 {{ active.metrics.f1 | number: '1.2-2' }}
              }
            </div>
          }

          <h5 class="mt-4">Modelos recientes</h5>
          <div class="table-responsive">
            <table class="table table-sm table-hover align-middle">
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
                    <td>{{ m.metrics?.f1 != null ? (m.metrics!.f1 | number: '1.2-2') : '—' }}</td>
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
                    <td colspan="4" class="text-muted text-center py-3">Sin modelos aún. Sube un dataset y entrena desde el API o web-dashboard.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
})
class WekaLabPageComponent {
  private readonly api = inject(WekaLabApiService);

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly dash = signal<import('../../core/services/weka-lab-api.service').WekaDashboard | null>(null);
  protected readonly models = signal<import('../../core/services/weka-lab-api.service').WekaModelRow[]>([]);

  constructor() {
    this.api.dashboard$().subscribe({
      next: (d) => {
        this.dash.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          extractHttpErrorMessage(
            err,
            'No se pudo conectar con Weka Lab. Verifica J48_URL en Render y que cop-j48-python esté Live.',
          ),
        );
      },
    });
    this.api.models$().subscribe({
      next: (rows) => this.models.set(rows ?? []),
      error: () => undefined,
    });
  }
}

export const WEKA_LAB_ROUTES: Routes = [{ path: '', component: WekaLabPageComponent }];
