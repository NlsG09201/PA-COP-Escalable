import { CommonModule } from '@angular/common';
import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ArffDatasetSchema,
  ClinicalPrediction,
  DEFAULT_ARFF_SCHEMA,
  WekaLabApiService,
  WekaModelRow,
} from '../../core/services/weka-lab-api.service';
import { extractHttpErrorMessage } from '../../core/http/extract-http-error-message';

@Component({
  selector: 'app-weka-clinical-predict',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="row g-4">
      <div class="col-lg-6">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <h5 class="h6 mb-1">Predicción con modelo J48 (ARFF)</h5>
            <p class="text-muted small mb-3">
              Ingresa las variables de <code>relapse_risk_j48.arff</code>. El motor usa el dataset integrado
              ({{ schema().rows | number }} registros) y la clase objetivo <strong>{{ schema().target }}</strong>.
            </p>

            <form [formGroup]="form" (ngSubmit)="submit()" class="row g-2">
              <div class="col-12">
                <label class="form-label small">Modelo</label>
                <select class="form-select form-select-sm" formControlName="modelId">
                  <option value="">J48 recaída (ARFF integrado)</option>
                  @for (m of models(); track m.id) {
                    <option [value]="m.id">{{ m.name }}{{ m.isActive ? ' ★' : '' }}</option>
                  }
                </select>
              </div>

              <div class="col-md-6">
                <label class="form-label small">Género</label>
                <select class="form-select form-select-sm" formControlName="gender">
                  <option value="F">F — Femenino</option>
                  <option value="M">M — Masculino</option>
                  <option value="O">O — Otro</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label small">Grupo de edad</label>
                <select class="form-select form-select-sm" formControlName="age_group">
                  <option value="YOUNG_ADULT">Joven adulto</option>
                  <option value="ADULT">Adulto</option>
                  <option value="SENIOR">Mayor</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label small">Sentimiento</label>
                <select class="form-select form-select-sm" formControlName="sentiment">
                  <option value="POSITIVE">Positivo</option>
                  <option value="NEUTRAL">Neutral</option>
                  <option value="NEGATIVE">Negativo</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label small">Bienestar</label>
                <select class="form-select form-select-sm" formControlName="wellbeing">
                  <option value="HIGH">Alto</option>
                  <option value="MEDIUM">Medio</option>
                  <option value="LOW">Bajo</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label small">Asistencia</label>
                <select class="form-select form-select-sm" formControlName="attendance">
                  <option value="REGULAR">Regular</option>
                  <option value="IRREGULAR">Irregular</option>
                  <option value="ABSENT">Ausente</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label small">Adherencia</label>
                <select class="form-select form-select-sm" formControlName="adherence">
                  <option value="HIGH">Alta</option>
                  <option value="MEDIUM">Media</option>
                  <option value="LOW">Baja</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label small">Sintomas</label>
                <select class="form-select form-select-sm" formControlName="symptoms">
                  <option value="MILD">Leves</option>
                  <option value="MODERATE">Moderados</option>
                  <option value="SEVERE">Severos</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label small">Recaida previa</label>
                <select class="form-select form-select-sm" formControlName="prior_relapse">
                  <option value="NO">No</option>
                  <option value="YES">Si</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label small">Estado emocional</label>
                <select class="form-select form-select-sm" formControlName="emotional_state">
                  <option value="STABLE">Estable</option>
                  <option value="VOLATILE">Volatil</option>
                  <option value="CRISIS">Crisis</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label small">Días sin sesión: {{ form.controls.days_since_last.value }}</label>
                <input type="range" class="form-range" min="0" max="90" formControlName="days_since_last" />
              </div>
              <div class="col-12">
                <label class="form-label small">Ansiedad: {{ form.controls.anxiety.value | number: '1.2-2' }}</label>
                <input type="range" class="form-range" min="0" max="1" step="0.05" formControlName="anxiety" />
              </div>
              <div class="col-12">
                <label class="form-label small">Depresión: {{ form.controls.depression.value | number: '1.2-2' }}</label>
                <input type="range" class="form-range" min="0" max="1" step="0.05" formControlName="depression" />
              </div>
              <div class="col-12">
                <label class="form-label small">Estres: {{ form.controls.stress.value | number: '1.2-2' }}</label>
                <input type="range" class="form-range" min="0" max="1" step="0.05" formControlName="stress" />
              </div>
              <div class="col-12 pt-2">
                <button type="submit" class="btn btn-primary w-100" [disabled]="predicting() || form.invalid">
                  @if (predicting()) {
                    <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                  }
                  Ejecutar predicción J48
                </button>
              </div>
            </form>
            @if (error()) {
              <div class="alert alert-danger py-2 mt-3 mb-0 small">{{ error() }}</div>
            }
          </div>
        </div>
      </div>

      <div class="col-lg-6">
        @if (result(); as r) {
          <div
            class="card border-0 shadow-sm mb-3"
            [class.border-danger]="r.alertLevel === 'CRITICAL'"
            [class.border-warning]="r.alertLevel === 'WARNING'"
            [class.border-success]="r.alertLevel === 'NORMAL'">
            <div class="card-body">
              @if (r.offline) {
                <span class="badge text-bg-secondary mb-2">Modo offline (heurística ARFF)</span>
              }
              <p class="text-muted small mb-1">Nivel de riesgo ({{ schema().target }})</p>
              <p class="display-6 fw-bold mb-2" [class.text-danger]="r.classLabel === 'HIGH'" [class.text-warning]="r.classLabel === 'MEDIUM'" [class.text-success]="r.classLabel === 'LOW'">
                {{ r.classLabel }}
              </p>
              <p class="mb-0 small">
                Score de riesgo {{ (r.riskScore * 100) | number: '1.1-1' }}% · Bienestar psicológico
                {{ (r.psychologicalScore * 100) | number: '1.1-1' }}%
              </p>
              <p class="text-muted small mb-0">Prob. recaída alta: {{ (r.relapseProbability * 100) | number: '1.1-1' }}%</p>
            </div>
          </div>
          <div class="card border-0 shadow-sm mb-3">
            <div class="card-body">
              <h6 class="small text-muted mb-2">Probabilidades por clase</h6>
              <ul class="list-unstyled mb-0 small">
                @for (entry of probEntries(r); track entry.key) {
                  <li class="d-flex justify-content-between py-1 border-bottom">
                    <span>{{ entry.key }}</span>
                    <strong>{{ (entry.value * 100) | number: '1.1-1' }}%</strong>
                  </li>
                }
              </ul>
            </div>
          </div>
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <h6 class="small text-muted mb-2">Recomendaciones</h6>
              <ul class="small mb-0 ps-3">
                @for (rec of r.recommendations; track rec) {
                  <li class="mb-1">{{ rec }}</li>
                }
              </ul>
            </div>
          </div>
        } @else {
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body d-flex align-items-center justify-content-center text-muted text-center">
              <p class="mb-0 small">Complete el formulario y pulse «Ejecutar predicción J48» para ver el resultado.</p>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class WekaClinicalPredictComponent {
  private readonly api = inject(WekaLabApiService);
  private readonly fb = inject(FormBuilder);

  readonly schema = input<ArffDatasetSchema>(DEFAULT_ARFF_SCHEMA);
  readonly models = input<WekaModelRow[]>([]);
  readonly predicted = output<ClinicalPrediction>();

  protected readonly predicting = signal(false);
  protected readonly error = signal('');
  protected readonly result = signal<ClinicalPrediction | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    modelId: [''],
    gender: ['F', Validators.required],
    age_group: ['ADULT', Validators.required],
    sentiment: ['NEUTRAL', Validators.required],
    wellbeing: ['MEDIUM', Validators.required],
    anxiety: [0.5, [Validators.required, Validators.min(0), Validators.max(1)]],
    depression: [0.4, [Validators.required, Validators.min(0), Validators.max(1)]],
    stress: [0.45, [Validators.required, Validators.min(0), Validators.max(1)]],
    attendance: ['REGULAR', Validators.required],
    days_since_last: [14, [Validators.required, Validators.min(0), Validators.max(90)]],
    adherence: ['MEDIUM', Validators.required],
    symptoms: ['MODERATE', Validators.required],
    prior_relapse: ['NO', Validators.required],
    emotional_state: ['STABLE', Validators.required],
  });

  protected probEntries(r: ClinicalPrediction): Array<{ key: string; value: number }> {
    return Object.entries(r.probabilities ?? {}).map(([key, value]) => ({ key, value }));
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.predicting.set(true);
    this.error.set('');
    const payload = {
      modelId: raw.modelId || undefined,
      gender: raw.gender,
      age_group: raw.age_group,
      sentiment: raw.sentiment,
      wellbeing: raw.wellbeing,
      anxiety: Number(raw.anxiety),
      depression: Number(raw.depression),
      stress: Number(raw.stress),
      attendance: raw.attendance,
      days_since_last: Number(raw.days_since_last),
      adherence: raw.adherence,
      symptoms: raw.symptoms,
      prior_relapse: raw.prior_relapse,
      emotional_state: raw.emotional_state,
    };
    this.api.predictClinical$(payload).subscribe({
      next: (res) => {
        this.result.set(res);
        this.predicted.emit(res);
        this.predicting.set(false);
      },
      error: (err) => {
        this.predicting.set(false);
        this.error.set(extractHttpErrorMessage(err, 'No se pudo ejecutar la predicción.'));
      },
    });
  }
}
