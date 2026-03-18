import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import { catchError, of, switchMap } from 'rxjs';
import { OdontogramApiService, ToothHistoryVm, ToothStateVm, ToothStatus } from './data-access/odontogram-api.service';
import { selectSelectedPatient, selectSelectedPatientId } from '../../store/patients.selectors';

type ToothVisual = ToothStateVm & {
  x: number;
  y: number;
  row: 'upper' | 'lower';
};

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

function buildDefaultRecords(): ToothStateVm[] {
  return [...UPPER_TEETH, ...LOWER_TEETH].map((tooth) => ({
    tooth,
    status: 'HEALTHY',
    diagnosis: '',
    treatment: '',
    observations: '',
    updatedAt: new Date().toISOString(),
    history: []
  }));
}

@Component({
  standalone: true,
  imports: [AsyncPipe, DatePipe, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-shell">
      <div class="page-header card border-0 shadow-sm">
        <div class="card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <p class="eyebrow mb-2">Modulo Clinico Odontologico</p>
            <h2 class="h4 mb-1">Odontograma Interactivo</h2>
            <p class="text-muted mb-0">Selecciona una pieza, registra diagnostico, tratamiento y observa su evolucion clinica.</p>
          </div>
          <div class="context-chip">
            <span class="context-label">Paciente activo</span>
            <strong>{{ (selectedPatient$ | async)?.name ?? 'Selecciona un paciente' }}</strong>
          </div>
        </div>
      </div>

      <div class="row g-4 mt-1">
        <div class="col-xl-8">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex flex-wrap gap-2 mb-4">
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

              <svg viewBox="0 0 1080 470" class="odontogram-svg" role="img" aria-label="Odontograma clinico">
                <path d="M90 180 C290 112 790 112 990 180" class="arc-line"></path>
                <path d="M90 292 C290 360 790 360 990 292" class="arc-line"></path>
                <text x="72" y="48" class="arc-label">Dentadura superior</text>
                <text x="72" y="438" class="arc-label">Dentadura inferior</text>

                @for (tooth of upperTeeth(); track tooth.tooth) {
                  <g
                    class="tooth-group"
                    [class.active]="selectedTooth() === tooth.tooth"
                    [attr.transform]="'translate(' + tooth.x + ' ' + tooth.y + ')'"
                    (click)="selectTooth(tooth.tooth)">
                    <text x="30" y="-12" text-anchor="middle" class="tooth-number">{{ tooth.tooth }}</text>
                    <path
                      [attr.d]="toothPath"
                      [attr.fill]="statusStyles[tooth.status].fill"
                      [attr.stroke]="statusStyles[tooth.status].stroke"
                      stroke-width="2.5"></path>
                    <path d="M22 30 C25 41 35 41 38 30" fill="none" stroke="#d0d5dd" stroke-width="1.5"></path>
                    @switch (tooth.status) {
                      @case ('CARIES') {
                        <circle cx="30" cy="50" r="9" fill="#d9485f"></circle>
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
                  </g>
                }

                @for (tooth of lowerTeeth(); track tooth.tooth) {
                  <g
                    class="tooth-group"
                    [class.active]="selectedTooth() === tooth.tooth"
                    [attr.transform]="'translate(' + tooth.x + ' ' + tooth.y + ')'"
                    (click)="selectTooth(tooth.tooth)">
                    <path
                      [attr.d]="toothPath"
                      [attr.fill]="statusStyles[tooth.status].fill"
                      [attr.stroke]="statusStyles[tooth.status].stroke"
                      stroke-width="2.5"></path>
                    <path d="M22 30 C25 41 35 41 38 30" fill="none" stroke="#d0d5dd" stroke-width="1.5"></path>
                    @switch (tooth.status) {
                      @case ('CARIES') {
                        <circle cx="30" cy="50" r="9" fill="#d9485f"></circle>
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
                  </g>
                }
              </svg>
            </div>
          </div>
        </div>

        <div class="col-xl-4">
          <div class="card border-0 shadow-sm h-100">
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
                <div>
                  <label class="form-label">Estado</label>
                  <select class="form-select" formControlName="status">
                    @for (status of statusEntries; track status.key) {
                      <option [value]="status.key">{{ status.value.label }}</option>
                    }
                  </select>
                </div>

                <div>
                  <label class="form-label">Diagnostico</label>
                  <input class="form-control" formControlName="diagnosis" placeholder="Ej. Caries oclusal incipiente" />
                </div>

                <div>
                  <label class="form-label">Tratamiento</label>
                  <input class="form-control" formControlName="treatment" placeholder="Ej. Restauracion resina compuesta" />
                </div>

                <div>
                  <label class="form-label">Observaciones clinicas</label>
                  <textarea class="form-control" rows="4" formControlName="observations"></textarea>
                </div>

                <button class="btn btn-primary" [disabled]="saving() || toothForm.invalid">
                  {{ saving() ? 'Guardando...' : 'Guardar evolucion del diente' }}
                </button>
              </form>

              <div class="divider my-4"></div>

              <div class="d-flex justify-content-between align-items-center mb-3">
                <h4 class="h6 mb-0">Historial por diente</h4>
                <span class="text-muted small">{{ selectedRecord()?.history?.length ?? 0 }} eventos</span>
              </div>

              <div class="history-list">
                @for (event of selectedRecord()?.history ?? []; track event.at + event.status + event.diagnosis) {
                  <article class="history-item">
                    <div class="d-flex justify-content-between gap-3">
                      <strong>{{ statusStyles[event.status].label }}</strong>
                      <span class="text-muted small">{{ event.at | date: 'short' }}</span>
                    </div>
                    <p class="mb-1"><strong>Dx:</strong> {{ event.diagnosis || 'Sin diagnostico' }}</p>
                    <p class="mb-1"><strong>Tx:</strong> {{ event.treatment || 'Sin tratamiento' }}</p>
                    <p class="mb-0 text-muted">{{ event.observations || 'Sin observaciones' }}</p>
                  </article>
                } @empty {
                  <div class="empty-state">No hay historial registrado para esta pieza dental.</div>
                }
              </div>
            </div>
          </div>
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
      transition: transform 150ms ease, filter 150ms ease;
      filter: drop-shadow(0 4px 8px rgba(15, 23, 42, 0.08));
    }

    .tooth-group:hover {
      transform: scale(1.04);
    }

    .tooth-group.active path:first-of-type {
      stroke-width: 5;
      filter: drop-shadow(0 0 0.65rem rgba(25, 113, 194, 0.28));
    }

    .tooth-number {
      fill: #344054;
      font-size: 14px;
      font-weight: 700;
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
      max-height: 330px;
      overflow: auto;
      padding-right: 0.25rem;
    }

    .history-item {
      border: 1px solid #edf2f7;
      border-radius: 16px;
      padding: 0.9rem;
      background: #fff;
    }

    .empty-state {
      border: 1px dashed #d0d5dd;
      border-radius: 16px;
      padding: 1rem;
      color: #667085;
      background: #fafafa;
    }
  `
})
class OdontogramPageComponent {
  private readonly odontogramApi = inject(OdontogramApiService);
  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly toothPath = TOOTH_PATH;
  protected readonly statusStyles = STATUS_STYLES;
  protected readonly statusEntries = Object.entries(STATUS_STYLES).map(([key, value]) => ({ key: key as ToothStatus, value }));
  protected readonly selectedPatient$ = this.store.select(selectSelectedPatient);

  private readonly patientId = signal<string | null>(null);
  private readonly toothRecords = signal<ToothStateVm[]>(buildDefaultRecords());
  protected readonly selectedTooth = signal<string>('11');
  protected readonly saving = signal(false);

  protected readonly selectedRecord = computed(
    () => this.toothRecords().find((record) => record.tooth === this.selectedTooth()) ?? null
  );

  protected readonly upperTeeth = computed(() => this.buildVisuals(UPPER_TEETH, 'upper'));
  protected readonly lowerTeeth = computed(() => this.buildVisuals(LOWER_TEETH, 'lower'));

  protected readonly toothForm = this.fb.nonNullable.group({
    status: ['HEALTHY' as ToothStatus, [Validators.required]],
    diagnosis: [''],
    treatment: [''],
    observations: ['']
  });

  constructor() {
    this.store
      .select(selectSelectedPatientId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((patientId) => {
          this.patientId.set(patientId);
          return patientId ? this.odontogramApi.getByPatient$(patientId).pipe(catchError(() => of([]))) : of([]);
        })
      )
      .subscribe((records) => {
        this.toothRecords.set(this.mergeWithDefaults(records));
        this.syncSelection();
      });
  }

  protected selectTooth(tooth: string): void {
    this.selectedTooth.set(tooth);
    this.syncForm();
  }

  protected saveTooth(): void {
    if (this.toothForm.invalid) {
      this.toothForm.markAllAsTouched();
      return;
    }

    const current = this.selectedRecord();
    if (!current) {
      return;
    }

    const payload = this.toothForm.getRawValue();
    const historyEntry: ToothHistoryVm = {
      at: new Date().toISOString(),
      status: payload.status,
      diagnosis: payload.diagnosis.trim(),
      treatment: payload.treatment.trim(),
      observations: payload.observations.trim()
    };

    const optimistic: ToothStateVm = {
      ...current,
      ...payload,
      updatedAt: historyEntry.at,
      history: [historyEntry, ...current.history]
    };

    this.applyToothUpdate(optimistic);

    const patientId = this.patientId();
    if (!patientId) {
      return;
    }

    this.saving.set(true);
    this.odontogramApi
      .patchTooth$(patientId, {
        tooth: optimistic.tooth,
        status: optimistic.status,
        diagnosis: optimistic.diagnosis,
        treatment: optimistic.treatment,
        observations: optimistic.observations,
        history: optimistic.history
      })
      .pipe(catchError(() => of(optimistic)), takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        this.applyToothUpdate({
          ...optimistic,
          ...saved,
          history: saved.history.length > 0 ? saved.history : optimistic.history
        });
        this.saving.set(false);
      });
  }

  private buildVisuals(order: string[], row: 'upper' | 'lower'): ToothVisual[] {
    const map = new Map(this.toothRecords().map((record) => [record.tooth, record]));
    return order.map((tooth, index) => {
      const gap = index >= 8 ? 28 : 0;
      const baseX = 86 + index * 58 + gap;
      const x = row === 'upper' ? baseX : baseX;
      const y = row === 'upper' ? 74 : 214;
      return {
        ...(map.get(tooth) ?? buildDefaultRecords().find((record) => record.tooth === tooth)!),
        x,
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
        history: record.history ?? []
      });
    });
    return [...base.values()];
  }

  private applyToothUpdate(updated: ToothStateVm): void {
    this.toothRecords.update((records) =>
      records.map((record) => (record.tooth === updated.tooth ? updated : record))
    );
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
    if (!selected) {
      return;
    }

    this.toothForm.patchValue(
      {
        status: selected.status,
        diagnosis: selected.diagnosis,
        treatment: selected.treatment,
        observations: selected.observations
      },
      { emitEvent: false }
    );
  }
}

export const ODONTOGRAM_ROUTES: Routes = [{ path: '', component: OdontogramPageComponent }];
