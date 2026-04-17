import { AsyncPipe, DatePipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  ElementRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { catchError, map, of, switchMap } from 'rxjs';
import {
  DamageFinding,
  OdontogramApiService,
  OrthodonticSimulationVm,
  ToothHistoryVm,
  ToothStateVm,
  ToothStatus
} from '../data-access/odontogram-api.service';
import { ClinicalHistoryApiService } from '../../clinical-history/data-access/clinical-history-api.service';
import { OdontologyApiService, TreatmentPlanVm } from '../../../core/services/odontology-api.service';
import { TreatmentPlanPanelComponent } from '../../odontology/components/treatment-plan-panel.component';
import { selectSelectedPatient, selectSelectedPatientId } from '../../../store/patients.selectors';
import { Dentition3dScene } from '../lib/dentition-3d.scene';
import { sanitizeClinicalText } from '../lib/clinical-text.sanitizer';

type ToothVisual = ToothStateVm & { x: number; y: number; row: 'upper' | 'lower' };

const TOOTH_PATH =
  'M30 4 C22 4 14 11 13 22 C12 31 16 39 16 47 C16 60 11 72 14 85 C17 95 24 104 30 112 C36 104 43 95 46 85 C49 72 44 60 44 47 C44 39 48 31 47 22 C46 11 38 4 30 4 Z';

const UPPER_TEETH = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_TEETH = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

const STATUS_STYLES: Record<ToothStatus, { fill: string; stroke: string; label: string }> = {
  HEALTHY: { fill: '#ffffff', stroke: '#98a2b3', label: 'Sano' },
  CARIES: { fill: '#ffe3e3', stroke: '#d9485f', label: 'Caries' },
  RESTORATION: { fill: '#e7f5ff', stroke: '#1971c2', label: 'Restauracion' },
  EXTRACTION: { fill: '#fff3bf', stroke: '#f08c00', label: 'Extraccion' },
  TREATMENT: { fill: '#e6fcf5', stroke: '#099268', label: 'Tratamiento' }
};

const DAMAGE_OPTIONS: { id: DamageFinding; label: string }[] = [
  { id: 'FRACTURE', label: 'Fractura' },
  { id: 'CAVITY', label: 'Caries activa' },
  { id: 'WEAR', label: 'Desgaste' },
  { id: 'ABFRACTION', label: 'Abfracción' },
  { id: 'ROOT_RESORPTION', label: 'Reabsorción radicular' },
  { id: 'PULPITIS', label: 'Pulpitis' },
  { id: 'PERIAPICAL_LESION', label: 'Lesión periapical' },
  { id: 'STAINING', label: 'Pigmentación' },
  { id: 'OTHER', label: 'Otro' }
];

function buildDefaultRecords(): ToothStateVm[] {
  return [...UPPER_TEETH, ...LOWER_TEETH].map((tooth) => ({
    tooth,
    status: 'HEALTHY',
    braces: false,
    damages: [],
    diagnosis: '',
    treatment: '',
    clinicalObservations: '',
    updatedAt: new Date().toISOString(),
    history: []
  }));
}

@Component({
  standalone: true,
  selector: 'app-advanced-odontogram-page',
  imports: [AsyncPipe, DatePipe, ReactiveFormsModule, TreatmentPlanPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-shell">
      <div class="page-header card border-0 shadow-sm">
        <div class="card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <p class="eyebrow mb-2">Modulo Clinico Odontologico</p>
            <h2 class="h4 mb-1">Odontograma avanzado (ortodoncia + 3D)</h2>
            <p class="text-muted mb-0">
              Marcación de brackets, daños estructurales, observaciones clinicas, historial y simulación ortodóncica.
            </p>
          </div>
          <div class="context-chip">
            <span class="context-label">Paciente activo</span>
            <strong>{{ (selectedPatient$ | async)?.name ?? 'Selecciona un paciente' }}</strong>
          </div>
        </div>
      </div>

      <div class="row g-4 mt-1">
        <div class="col-xl-7">
          <div class="card border-0 shadow-sm mb-4">
            <div class="card-body">
              <div class="d-flex flex-wrap gap-2 mb-3">
                @for (status of statusEntries; track status.key) {
                  <span class="legend-chip">
                    <span
                      class="legend-dot"
                      [style.background]="status.value.fill"
                      [style.border-color]="status.value.stroke"></span>
                    {{ status.value.label }}
                  </span>
                }
              </div>

              <svg viewBox="0 0 1080 470" class="odontogram-svg" role="img" aria-label="Odontograma clinico avanzado">
                <path d="M90 180 C290 112 790 112 990 180" class="arc-line"></path>
                <path d="M90 292 C290 360 790 360 990 292" class="arc-line"></path>
                <text x="72" y="48" class="arc-label">Dentadura superior</text>
                <text x="72" y="438" class="arc-label">Dentadura inferior</text>

                @for (tooth of upperTeeth(); track tooth.tooth) {
                  <g
                    class="tooth-group"
                    [class.active]="selectedTooth() === tooth.tooth"
                    [attr.transform]="'translate(' + tooth.x + ' ' + tooth.y + ')'">
                    <text x="30" y="-12" text-anchor="middle" class="tooth-number">{{ tooth.tooth }}</text>
                    <path
                      [attr.d]="toothPath"
                      [attr.fill]="statusStyles[tooth.status].fill"
                      [attr.stroke]="statusStyles[tooth.status].stroke"
                      stroke-width="2.5"></path>
                    <path d="M22 30 C25 41 35 41 38 30" fill="none" stroke="#d0d5dd" stroke-width="1.5"></path>
                    @if (tooth.braces) {
                      <rect x="10" y="18" width="40" height="3" rx="1" fill="#adb5bd" opacity="0.95"></rect>
                      <rect x="12" y="14" width="6" height="10" rx="1" fill="#ced4da"></rect>
                      <rect x="42" y="14" width="6" height="10" rx="1" fill="#ced4da"></rect>
                    }
                    @for (d of tooth.damages; track d) {
                      @switch (d) {
                        @case ('FRACTURE') {
                          <path d="M16 52 L44 80 M44 52 L16 80" stroke="#212529" stroke-width="2.5" stroke-linecap="round"></path>
                        }
                        @case ('CAVITY') {
                          <circle cx="30" cy="52" r="8" fill="#d9485f" opacity="0.85"></circle>
                        }
                        @case ('WEAR') {
                          <path d="M14 88 H46" stroke="#495057" stroke-width="3" stroke-linecap="round"></path>
                        }
                        @case ('ABFRACTION') {
                          <path d="M10 60 Q30 48 50 60" fill="none" stroke="#7950f2" stroke-width="2.5"></path>
                        }
                        @case ('ROOT_RESORPTION') {
                          <path d="M30 90 L30 108" stroke="#868e96" stroke-width="3"></path>
                        }
                        @case ('PULPITIS') {
                          <circle cx="30" cy="48" r="4" fill="#fa5252"></circle>
                        }
                        @case ('PERIAPICAL_LESION') {
                          <circle cx="30" cy="102" r="6" fill="none" stroke="#e67700" stroke-width="2"></circle>
                        }
                        @case ('STAINING') {
                          <ellipse cx="26" cy="40" rx="10" ry="4" fill="#9775fa" opacity="0.35"></ellipse>
                        }
                        @case ('OTHER') {
                          <text x="30" y="58" text-anchor="middle" class="damage-other">!</text>
                        }
                      }
                    }
                    @switch (tooth.status) {
                      @case ('CARIES') {
                        @if (!tooth.damages.includes('CAVITY')) {
                          <circle cx="30" cy="50" r="9" fill="#d9485f"></circle>
                        }
                      }
                      @case ('RESTORATION') {
                        <rect x="21" y="41" width="18" height="18" rx="4" fill="#1971c2"></rect>
                      }
                      @case ('EXTRACTION') {
                        <path d="M18 38 L42 66 M42 38 L18 66" stroke="#f08c00" stroke-width="5" stroke-linecap="round"></path>
                      }
                      @case ('TREATMENT') {
                        <path d="M20 50 H40" stroke="#099268" stroke-width="5" stroke-linecap="round"></path>
                        <circle cx="30" cy="50" r="11" fill="none" stroke="#099268" stroke-width="2"></circle>
                      }
                    }
                    <rect
                      x="6"
                      y="-20"
                      width="48"
                      height="140"
                      fill="#000"
                      opacity="0"
                      class="tooth-hitbox"
                      (pointerdown)="$event.preventDefault(); $event.stopPropagation(); selectTooth(tooth.tooth)"></rect>
                  </g>
                }

                @for (tooth of lowerTeeth(); track tooth.tooth) {
                  <g
                    class="tooth-group"
                    [class.active]="selectedTooth() === tooth.tooth"
                    [attr.transform]="'translate(' + tooth.x + ' ' + tooth.y + ')'">
                    <path
                      [attr.d]="toothPath"
                      [attr.fill]="statusStyles[tooth.status].fill"
                      [attr.stroke]="statusStyles[tooth.status].stroke"
                      stroke-width="2.5"></path>
                    <path d="M22 30 C25 41 35 41 38 30" fill="none" stroke="#d0d5dd" stroke-width="1.5"></path>
                    @if (tooth.braces) {
                      <rect x="10" y="18" width="40" height="3" rx="1" fill="#adb5bd" opacity="0.95"></rect>
                      <rect x="12" y="14" width="6" height="10" rx="1" fill="#ced4da"></rect>
                      <rect x="42" y="14" width="6" height="10" rx="1" fill="#ced4da"></rect>
                    }
                    @for (d of tooth.damages; track d) {
                      @switch (d) {
                        @case ('FRACTURE') {
                          <path d="M16 52 L44 80 M44 52 L16 80" stroke="#212529" stroke-width="2.5" stroke-linecap="round"></path>
                        }
                        @case ('CAVITY') {
                          <circle cx="30" cy="52" r="8" fill="#d9485f" opacity="0.85"></circle>
                        }
                        @case ('WEAR') {
                          <path d="M14 88 H46" stroke="#495057" stroke-width="3" stroke-linecap="round"></path>
                        }
                        @case ('ABFRACTION') {
                          <path d="M10 60 Q30 48 50 60" fill="none" stroke="#7950f2" stroke-width="2.5"></path>
                        }
                        @case ('ROOT_RESORPTION') {
                          <path d="M30 90 L30 108" stroke="#868e96" stroke-width="3"></path>
                        }
                        @case ('PULPITIS') {
                          <circle cx="30" cy="48" r="4" fill="#fa5252"></circle>
                        }
                        @case ('PERIAPICAL_LESION') {
                          <circle cx="30" cy="102" r="6" fill="none" stroke="#e67700" stroke-width="2"></circle>
                        }
                        @case ('STAINING') {
                          <ellipse cx="26" cy="40" rx="10" ry="4" fill="#9775fa" opacity="0.35"></ellipse>
                        }
                        @case ('OTHER') {
                          <text x="30" y="58" text-anchor="middle" class="damage-other">!</text>
                        }
                      }
                    }
                    @switch (tooth.status) {
                      @case ('CARIES') {
                        @if (!tooth.damages.includes('CAVITY')) {
                          <circle cx="30" cy="50" r="9" fill="#d9485f"></circle>
                        }
                      }
                      @case ('RESTORATION') {
                        <rect x="21" y="41" width="18" height="18" rx="4" fill="#1971c2"></rect>
                      }
                      @case ('EXTRACTION') {
                        <path d="M18 38 L42 66 M42 38 L18 66" stroke="#f08c00" stroke-width="5" stroke-linecap="round"></path>
                      }
                      @case ('TREATMENT') {
                        <path d="M20 50 H40" stroke="#099268" stroke-width="5" stroke-linecap="round"></path>
                        <circle cx="30" cy="50" r="11" fill="none" stroke="#099268" stroke-width="2"></circle>
                      }
                    }
                    <text x="30" y="135" text-anchor="middle" class="tooth-number">{{ tooth.tooth }}</text>
                    <rect
                      x="6"
                      y="-20"
                      width="48"
                      height="140"
                      fill="#000"
                      opacity="0"
                      class="tooth-hitbox"
                      (pointerdown)="$event.preventDefault(); $event.stopPropagation(); selectTooth(tooth.tooth)"></rect>
                  </g>
                }
              </svg>
            </div>
          </div>
        </div>

        <div class="col-xl-5">
          <div class="card border-0 shadow-sm mb-3">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h3 class="h6 mb-0">Vista 3D interactiva</h3>
                <span class="text-muted small">Three.js</span>
              </div>
              <canvas #arch3d class="arch-3d" aria-label="Modelo 3D de dentición"></canvas>
              <p class="text-muted small mt-2 mb-0">
                Arrastra para orbitar. El tiempo de simulación interpola poses entre keyframes clínicos.
              </p>
            </div>
          </div>

          <div class="card border-0 shadow-sm mb-3">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h3 class="h6 mb-0">Simulación ortodóncica</h3>
                <button type="button" class="btn btn-sm btn-outline-secondary" (click)="seedDemoSimulation()">
                  Demo keyframes
                </button>
              </div>
              <label class="form-label small">Progreso (t)</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                class="form-range"
                [value]="simulationT()"
                (input)="onSimSlider($event)" />
              <div class="d-flex justify-content-between small text-muted mb-2">
                <span>Inicio</span>
                <span>{{ (simulationT() * 100).toFixed(0) }}%</span>
                <span>Objetivo</span>
              </div>
              <button type="button" class="btn btn-primary btn-sm w-100" (click)="persistSimulation()" [disabled]="simSaving()">
                {{ simSaving() ? 'Guardando simulación...' : 'Guardar simulación en expediente' }}
              </button>
            </div>
          </div>

          <div class="card border-0 shadow-sm mb-4">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <p class="text-muted small mb-1">Pieza seleccionada</p>
                  <h3 class="h5 mb-0">{{ selectedTooth() }}</h3>
                </div>
                <span
                  class="status-pill"
                  [style.color]="statusStyles[selectedRecord()?.status ?? 'HEALTHY'].stroke"
                  [style.background]="statusStyles[selectedRecord()?.status ?? 'HEALTHY'].fill">
                  {{ statusStyles[selectedRecord()?.status ?? 'HEALTHY'].label }}
                </span>
              </div>

              <form [formGroup]="toothForm" (ngSubmit)="saveTooth()" class="d-grid gap-3">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="braces" formControlName="braces" />
                  <label class="form-check-label small fw-bold" for="braces">Brackets / aparato fijo</label>
                </div>

                <div>
                  <label class="form-label small fw-bold">Daños y hallazgos</label>
                  <div class="damage-grid">
                    @for (opt of damageOptions; track opt.id) {
                      <label class="damage-tile">
                        <input
                          type="checkbox"
                          [checked]="selectedDamages().includes(opt.id)"
                          (change)="toggleDamage(opt.id, $event)" />
                        <span>{{ opt.label }}</span>
                      </label>
                    }
                  </div>
                </div>

                <div>
                  <label class="form-label small fw-bold">Estado Clínico</label>
                  <select class="form-select border-0 bg-light shadow-none" formControlName="status">
                    @for (status of statusEntries; track status.key) {
                      <option [value]="status.key">{{ status.value.label }}</option>
                    }
                  </select>
                </div>

                <div>
                  <label class="form-label small fw-bold">Diagnóstico</label>
                  <input class="form-control border-0 bg-light shadow-none" formControlName="diagnosis" placeholder="Ej. API asintomática" />
                </div>

                <div>
                  <label class="form-label small fw-bold">Tratamiento Sugerido</label>
                  <input class="form-control border-0 bg-light shadow-none" formControlName="treatment" placeholder="Ej. Resina compuesta" />
                </div>

                <div>
                  <label class="form-label small fw-bold">Observaciones clínicas</label>
                  <textarea
                    class="form-control border-0 bg-light shadow-none"
                    rows="3"
                    formControlName="clinicalObservations"></textarea>
                </div>

                <button class="btn btn-primary shadow-sm" [disabled]="saving() || toothForm.invalid">
                  {{ saving() ? 'Guardando...' : 'Guardar evolución' }}
                </button>
              </form>

              <div class="divider my-4"></div>

              <div class="d-flex justify-content-between align-items-center mb-3">
                <h4 class="h6 mb-0">Historial por diente</h4>
                <span class="text-muted small">{{ selectedRecord()?.history?.length ?? 0 }} eventos</span>
              </div>

              <div class="history-list">
                @for (event of selectedRecord()?.history ?? []; track event.at + event.status + event.diagnosis) {
                  <article class="history-item mb-2">
                    <div class="d-flex justify-content-between gap-3 mb-1">
                      <strong>{{ statusStyles[event.status].label }}</strong>
                      <span class="text-muted small">{{ event.at | date: 'short' }}</span>
                    </div>
                    <p class="mb-1 small"><strong>Dx:</strong> {{ event.diagnosis || 'Sin diagnostico' }}</p>
                    <p class="mb-0 text-muted small">{{ event.observations || 'Sin observaciones' }}</p>
                  </article>
                } @empty {
                  <div class="empty-state">No hay historial registrado.</div>
                }
              </div>
            </div>
          </div>

          <app-treatment-plan-panel
            [plans]="treatmentPlans"
            [loading]="plansLoading"
            (suggest)="onSuggestPlan()">
          </app-treatment-plan-panel>
        </div>
      </div>
    </section>
  `,
  styles: `
    .page-shell {
      display: grid;
      gap: 1.25rem;
    }
    .page-header {
      background: linear-gradient(135deg, #ffffff 0%, #f5f8ff 100%);
    }
    .eyebrow {
      color: #1971c2;
      font-size: 0.75rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
    }
    .context-chip {
      min-width: 220px;
      border: 1px solid #dbe4ff;
      border-radius: 18px;
      padding: 0.85rem 1rem;
      background: #f8faff;
      display: grid;
      gap: 0.125rem;
    }
    .context-label {
      color: #667085;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .legend-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.75rem;
      border-radius: 999px;
      background: #f8fafc;
      border: 1px solid #e9ecef;
      font-size: 0.85rem;
    }
    .legend-dot {
      width: 0.9rem;
      height: 0.9rem;
      border-radius: 999px;
      border: 2px solid transparent;
      display: inline-block;
    }
    .odontogram-svg {
      width: 100%;
      min-height: 430px;
      border-radius: 24px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border: 1px solid #eef2f6;
      padding: 0.75rem;
    }
    .arc-line {
      fill: none;
      stroke: #cbd5e1;
      stroke-width: 3;
      stroke-dasharray: 8 8;
    }
    .arc-label {
      fill: #475467;
      font-size: 18px;
      font-weight: 600;
    }
    .tooth-group {
      cursor: pointer;
      filter: none;
    }
    .tooth-group text {
      pointer-events: none;
    }
    .arc-line,
    .arc-label {
      pointer-events: none;
    }
    .tooth-group * {
      pointer-events: none;
    }
    .tooth-group .tooth-hitbox {
      pointer-events: all;
    }
    .tooth-hitbox {
      touch-action: manipulation;
    }
    .tooth-group:hover {
      transform: scale(1.04);
    }
    .tooth-group.active path:nth-of-type(1) {
      stroke-width: 5;
      filter: none;
    }
    .tooth-number {
      fill: #344054;
      font-size: 14px;
      font-weight: 700;
    }
    .damage-other {
      fill: #c92a2a;
      font-size: 18px;
      font-weight: 800;
      pointer-events: none;
    }
    .status-pill {
      padding: 0.5rem 0.8rem;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 700;
    }
    .divider {
      border-top: 1px solid #edf2f7;
    }
    .history-list {
      display: grid;
      gap: 0.85rem;
      max-height: 220px;
      overflow: auto;
      padding-right: 0.25rem;
    }
    .history-item {
      border: 1px solid #edf2f7;
      border-radius: 12px;
      padding: 0.75rem;
      background: #fff;
    }
    .empty-state {
      border: 1px dashed #d0d5dd;
      border-radius: 16px;
      padding: 1rem;
      color: #667085;
      background: #fafafa;
    }
    .arch-3d {
      width: 100%;
      height: 280px;
      border-radius: 16px;
      background: #f1f3f5;
      border: 1px solid #e9ecef;
    }
    .damage-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.35rem;
    }
    .damage-tile {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.78rem;
      border: 1px solid #e9ecef;
      border-radius: 10px;
      padding: 0.35rem 0.45rem;
      background: #fff;
      margin: 0;
    }
  `
})
export class AdvancedOdontogramPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('arch3d') private arch3d?: ElementRef<HTMLCanvasElement>;

  private readonly odontogramApi = inject(OdontogramApiService);
  private readonly clinicalApi = inject(ClinicalHistoryApiService);
  private readonly odontologyApi = inject(OdontologyApiService);
  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private scene3d: Dentition3dScene | null = null;

  protected readonly toothPath = TOOTH_PATH;
  protected readonly statusStyles = STATUS_STYLES;
  protected readonly statusEntries = Object.entries(STATUS_STYLES).map(([key, value]) => ({ key: key as ToothStatus, value }));
  protected readonly damageOptions = DAMAGE_OPTIONS;
  protected readonly selectedPatient$ = this.store.select(selectSelectedPatient);

  private readonly patientId = signal<string | null>(null);
  private readonly toothRecords = signal<ToothStateVm[]>(buildDefaultRecords());
  protected readonly selectedTooth = signal<string>('11');
  protected readonly saving = signal(false);
  protected readonly simSaving = signal(false);
  protected readonly selectedDamages = signal<DamageFinding[]>([]);
  protected readonly simulation = signal<OrthodonticSimulationVm | null>(null);
  protected readonly simulationT = signal(0);
  protected readonly workingKeyframes = signal<OrthodonticSimulationVm['keyframes']>([]);

  protected readonly treatmentPlans = signal<TreatmentPlanVm[]>([]);
  protected readonly plansLoading = signal(false);

  protected readonly selectedRecord = computed(
    () => this.toothRecords().find((record) => record.tooth === this.selectedTooth()) ?? null
  );

  protected readonly upperTeeth = computed(() => this.buildVisuals(UPPER_TEETH, 'upper'));
  protected readonly lowerTeeth = computed(() => this.buildVisuals(LOWER_TEETH, 'lower'));

  protected readonly toothForm = this.fb.nonNullable.group({
    status: ['HEALTHY' as ToothStatus, [Validators.required]],
    diagnosis: [''],
    treatment: [''],
    clinicalObservations: [''],
    braces: [false]
  });

  constructor() {
    this.store
      .select(selectSelectedPatientId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((patientId: string | null) => {
          this.patientId.set(patientId);
          if (patientId) {
            this.loadPlans(patientId);
            return this.odontogramApi.getByPatient$(patientId).pipe(catchError(() => of({ teeth: [], simulation: null })));
          }
          return of({ teeth: [], simulation: null });
        })
      )
      .subscribe(({ teeth, simulation }) => {
        this.toothRecords.set(this.mergeWithDefaults(teeth));
        this.simulation.set(simulation);
        this.workingKeyframes.set(simulation?.keyframes?.length ? simulation.keyframes : []);
        this.syncSelection();
        this.refresh3d();
      });

    effect(() => {
      this.toothRecords();
      this.simulationT();
      this.workingKeyframes();
      queueMicrotask(() => this.refresh3d());
    });
  }

  ngAfterViewInit(): void {
    const el = this.arch3d?.nativeElement;
    if (el) {
      this.scene3d = new Dentition3dScene(el);
      this.refresh3d();
    }
  }

  ngOnDestroy(): void {
    this.scene3d?.dispose();
    this.scene3d = null;
  }

  protected loadPlans(patientId: string) {
    this.odontologyApi.getPatientPlans$(patientId).subscribe((plans) => {
      this.treatmentPlans.set(plans);
    });
  }

  protected onSuggestPlan() {
    const patientId = this.patientId();
    if (!patientId) return;

    this.plansLoading.set(true);
    this.odontologyApi.suggestPlan$(patientId).subscribe({
      next: (plan) => {
        this.treatmentPlans.update((prev) => [plan, ...prev]);
        this.plansLoading.set(false);
      },
      error: () => {
        this.plansLoading.set(false);
      }
    });
  }

  protected selectTooth(tooth: string): void {
    if (this.selectedTooth() === tooth) return;
    this.selectedTooth.set(tooth);
    this.syncForm();
  }

  protected toggleDamage(id: DamageFinding, ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;
    const cur = new Set(this.selectedDamages());
    if (checked) cur.add(id);
    else cur.delete(id);
    this.selectedDamages.set([...cur]);
  }

  protected onSimSlider(ev: Event): void {
    const v = Number((ev.target as HTMLInputElement).value);
    this.simulationT.set(Number.isFinite(v) ? v : 0);
    this.scene3d?.setSimulationT(this.simulationT());
  }

  protected seedDemoSimulation(): void {
    const months = 18;
    const upper = UPPER_TEETH;
    const posesForT = (t: number) =>
      Object.fromEntries(
        upper.map((fdi) => [
          fdi,
          {
            rotX: 0,
            rotY: t * 0.12 * (fdi.startsWith('1') || fdi.startsWith('2') ? 1 : -1),
            rotZ: t * 0.08,
            offsetMmX: 0,
            offsetMmY: t * 0.25,
            offsetMmZ: 0
          }
        ])
      );
    const keyframes = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ t, toothPoses: posesForT(t) }));
    this.workingKeyframes.set(keyframes);
    this.simulation.set({ plannedDurationMonths: months, notes: 'Secuencia demo generada localmente', keyframes });
    this.refresh3d();
  }

  protected persistSimulation(): void {
    const patientId = this.patientId();
    if (!patientId) return;
    const base = this.simulation();
    const kfs = this.workingKeyframes();
    if (kfs.length === 0) {
      this.seedDemoSimulation();
    }
    const payload: OrthodonticSimulationVm = {
      plannedDurationMonths: base?.plannedDurationMonths ?? 18,
      notes: base?.notes ?? '',
      keyframes: (this.workingKeyframes().length ? this.workingKeyframes() : this.simulation()?.keyframes) ?? []
    };
    this.simSaving.set(true);
    this.odontogramApi
      .patchSimulation$(patientId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sim) => {
          this.simulation.set(sim);
          if (sim?.keyframes) this.workingKeyframes.set(sim.keyframes);
          this.simSaving.set(false);
          this.refresh3d();
        },
        error: () => this.simSaving.set(false)
      });
  }

  protected saveTooth(): void {
    if (this.toothForm.invalid) {
      this.toothForm.markAllAsTouched();
      return;
    }

    const current = this.selectedRecord();
    if (!current) return;

    const raw = this.toothForm.getRawValue();
    const diagnosis = sanitizeClinicalText(raw.diagnosis);
    const treatment = sanitizeClinicalText(raw.treatment);
    const clinicalObservations = sanitizeClinicalText(raw.clinicalObservations);

    const historyEntry: ToothHistoryVm = {
      at: new Date().toISOString(),
      status: raw.status,
      diagnosis,
      treatment,
      observations: clinicalObservations
    };

    const optimistic: ToothStateVm = {
      ...current,
      status: raw.status,
      braces: raw.braces,
      damages: [...this.selectedDamages()],
      diagnosis,
      treatment,
      clinicalObservations,
      updatedAt: historyEntry.at,
      history: [historyEntry, ...current.history]
    };

    this.applyToothUpdate(optimistic);

    const patientId = this.patientId();
    if (!patientId) return;

    this.saving.set(true);
    this.odontogramApi
      .patchTooth$(patientId, optimistic)
      .pipe(
        switchMap((saved) =>
          this.clinicalApi
            .addEntry$(patientId, {
              category: 'ODONTOLOGICAL',
              type: `Odontograma avanzado diente ${optimistic.tooth}`,
              note: this.buildClinicalNote(optimistic)
            })
            .pipe(
              catchError(() => of(void 0)),
              map(() => saved)
            )
        ),
        catchError(() => of(optimistic)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((saved: ToothStateVm) => {
        this.applyToothUpdate({
          ...optimistic,
          ...saved,
          history: saved.history.length > 0 ? saved.history : optimistic.history
        });
        this.saving.set(false);
      });
  }

  private refresh3d(): void {
    if (!this.scene3d) return;
    const teeth = this.toothRecords().map((r) => ({
      fdi: r.tooth,
      status: r.status,
      braces: r.braces
    }));
    this.scene3d.buildArch(teeth);
    const kfs = this.workingKeyframes().length ? this.workingKeyframes() : this.simulation()?.keyframes ?? [];
    this.scene3d.setKeyframes(kfs.map((k) => ({ t: k.t, poses: k.toothPoses })));
    this.scene3d.setSimulationT(this.simulationT());
  }

  private buildVisuals(order: string[], row: 'upper' | 'lower'): ToothVisual[] {
    const map = new Map<string, ToothStateVm>(this.toothRecords().map((record) => [record.tooth, record]));
    return order.map((tooth, index): ToothVisual => {
      const gap = index >= 8 ? 28 : 0;
      const baseX = 86 + index * 58 + gap;
      const y = row === 'upper' ? 74 : 214;
      const base = map.get(tooth) ?? buildDefaultRecords().find((record) => record.tooth === tooth)!;
      return {
        ...base,
        x: baseX,
        y,
        row
      };
    });
  }

  private mergeWithDefaults(records: ToothStateVm[]): ToothStateVm[] {
    const base = new Map(buildDefaultRecords().map((record) => [record.tooth, record]));
    records.forEach((record) => {
      base.set(record.tooth, {
        ...(base.get(record.tooth) ?? record),
        ...record,
        damages: record.damages ?? [],
        braces: record.braces ?? false,
        clinicalObservations: record.clinicalObservations ?? '',
        history: record.history ?? []
      });
    });
    return [...base.values()];
  }

  private applyToothUpdate(updated: ToothStateVm): void {
    this.toothRecords.update((records) => records.map((record) => (record.tooth === updated.tooth ? updated : record)));
    this.syncForm();
  }

  private syncSelection(): void {
    if (!this.toothRecords().some((record) => record.tooth === this.selectedTooth())) {
      this.selectedTooth.set('11');
    }
    this.syncForm();
  }

  private syncForm(): void {
    const selected = this.selectedRecord();
    if (!selected) return;
    this.selectedDamages.set([...selected.damages]);
    this.toothForm.patchValue(
      {
        status: selected.status,
        diagnosis: selected.diagnosis,
        treatment: selected.treatment,
        clinicalObservations: selected.clinicalObservations,
        braces: selected.braces
      },
      { emitEvent: false }
    );
  }

  private buildClinicalNote(record: ToothStateVm): string {
    const parts = [
      `Pieza ${record.tooth}.`,
      `Estado: ${this.statusStyles[record.status].label}.`,
      record.braces ? 'Ortodoncia fija activa.' : '',
      record.damages.length ? `Daños: ${record.damages.join(', ')}.` : ''
    ];
    if (record.diagnosis.trim()) parts.push(`Diagnostico: ${record.diagnosis.trim()}.`);
    if (record.treatment.trim()) parts.push(`Tratamiento: ${record.treatment.trim()}.`);
    if (record.clinicalObservations.trim()) parts.push(`Observaciones: ${record.clinicalObservations.trim()}.`);
    return parts.filter(Boolean).join(' ');
  }
}
