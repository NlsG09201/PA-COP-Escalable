import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import { catchError, of } from 'rxjs';
import {
  ClinicalEntryVm,
  ClinicalHistoryApiService,
  EditableClinicalCategoryVm
} from './data-access/clinical-history-api.service';
import { selectSelectedPatientId } from '../../store/patients.selectors';

type ClinicalHistorySectionVm = {
  title: string;
  subtitle: string;
  entries: ClinicalEntryVm[];
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="card border-0 shadow-sm">
      <div class="card-body p-4">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
          <div>
            <h5 class="card-title mb-1">Historias Clinicas</h5>
            <p class="text-muted mb-0">Registros separados por categoria odontologica y psicologica.</p>
          </div>
        </div>

        @if (patientId()) {
          <div class="card border-0 bg-light-subtle mb-4">
            <div class="card-body">
              <form class="row g-3" [formGroup]="entryForm" (ngSubmit)="saveEntry()">
                <div class="col-md-3">
                  <label class="form-label">Categoria</label>
                  <select class="form-select" formControlName="category">
                    <option value="ODONTOLOGICAL">Odontologica</option>
                    <option value="PSYCHOLOGICAL">Psicologica</option>
                  </select>
                </div>
                <div class="col-md-4">
                  <label class="form-label">Tipo de registro</label>
                  <input class="form-control" formControlName="type" placeholder="Ej. Evolucion, diagnostico, sesion" />
                </div>
                <div class="col-md-5">
                  <label class="form-label">Nota clinica</label>
                  <textarea
                    class="form-control"
                    rows="2"
                    formControlName="note"
                    placeholder="Describe el hallazgo, intervencion o seguimiento"></textarea>
                </div>
                <div class="col-12 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                  <div>
                    @if (feedback(); as feedback) {
                      <span class="small" [class.text-success]="feedback.kind === 'success'" [class.text-danger]="feedback.kind === 'error'">
                        {{ feedback.text }}
                      </span>
                    }
                  </div>
                  <button class="btn btn-primary" type="submit" [disabled]="saving()">
                    {{ saving() ? 'Guardando...' : 'Agregar entrada clinica' }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        }

        @if (sections(); as sections) {
          <div class="row g-4">
            @for (section of sections; track section.title) {
              <div class="col-12 col-xl-6">
                <section class="history-section h-100">
                  <div class="history-section__header">
                    <div>
                      <h6 class="mb-1">{{ section.title }}</h6>
                      <p class="text-muted small mb-0">{{ section.subtitle }}</p>
                    </div>
                    <span class="badge rounded-pill text-bg-light">{{ section.entries.length }}</span>
                  </div>

                  @if (section.entries.length > 0) {
                    <div class="list-group list-group-flush">
                      @for (entry of section.entries; track entry.id) {
                        <article class="list-group-item px-0 history-entry">
                          <div class="d-flex flex-column flex-md-row justify-content-between gap-2 mb-2">
                            <div class="fw-semibold">{{ entry.type }}</div>
                            <span class="text-muted small">{{ entry.dateLabel }}</span>
                          </div>
                          <p class="mb-0 text-body-secondary">{{ entry.note }}</p>
                        </article>
                      }
                    </div>
                  } @else {
                    <div class="history-empty">
                      <strong class="d-block mb-1">Sin registros</strong>
                      <span class="text-muted small">Aun no hay notas de esta categoria para el paciente seleccionado.</span>
                    </div>
                  }
                </section>
              </div>
            }
          </div>
        } @else {
          <div class="history-empty">
            <strong class="d-block mb-1">Sin paciente seleccionado</strong>
            <span class="text-muted small">Selecciona un paciente para consultar sus historias clinicas.</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .history-section {
      border: 1px solid #e9eef5;
      border-radius: 1rem;
      padding: 1rem 1.25rem;
      background: #fff;
    }

    .history-section__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .history-entry + .history-entry {
      border-top: 1px solid #eef2f7;
    }

    .history-empty {
      border: 1px dashed #d7deea;
      border-radius: 0.85rem;
      padding: 1rem;
      background: #fafcff;
    }
  `
})
class ClinicalHistoryPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly clinicalApi = inject(ClinicalHistoryApiService);
  private readonly store = inject(Store);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly patientId = signal<string | null>(null);
  protected readonly entries = signal<ClinicalEntryVm[] | null>(null);
  protected readonly saving = signal(false);
  protected readonly feedback = signal<{ kind: 'success' | 'error'; text: string } | null>(null);
  protected readonly sections = computed(() => {
    const entries = this.entries();
    return entries === null ? null : this.buildSections(entries);
  });

  protected readonly entryForm = this.fb.nonNullable.group({
    category: ['ODONTOLOGICAL' as EditableClinicalCategoryVm, Validators.required],
    type: ['Evolucion', [Validators.required, Validators.maxLength(80)]],
    note: ['', [Validators.required, Validators.maxLength(2000)]]
  });

  constructor() {
    this.store
      .select(selectSelectedPatientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((patientId) => {
        this.patientId.set(patientId);
        this.feedback.set(null);
        if (!patientId) {
          this.entries.set(null);
          return;
        }
        this.loadEntries(patientId);
      });
  }

  protected saveEntry(): void {
    if (this.entryForm.invalid) {
      this.entryForm.markAllAsTouched();
      return;
    }

    const patientId = this.patientId();
    if (!patientId) {
      this.feedback.set({ kind: 'error', text: 'Selecciona un paciente antes de registrar una entrada clinica.' });
      return;
    }

    const value = this.entryForm.getRawValue();
    this.saving.set(true);
    this.feedback.set(null);

    this.clinicalApi
      .addEntry$(patientId, value)
      .pipe(
        catchError(() => {
          this.feedback.set({ kind: 'error', text: 'No fue posible guardar la entrada clinica.' });
          this.saving.set(false);
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((result) => {
        if (result === null) {
          return;
        }

        this.entryForm.patchValue({
          type: 'Evolucion',
          note: ''
        });
        this.entryForm.markAsPristine();
        this.entryForm.markAsUntouched();
        this.feedback.set({ kind: 'success', text: 'Entrada clinica registrada correctamente.' });
        this.saving.set(false);
        this.loadEntries(patientId);
      });
  }

  private loadEntries(patientId: string): void {
    this.clinicalApi
      .listByPatient$(patientId)
      .pipe(
        catchError(() => {
          this.feedback.set({ kind: 'error', text: 'No fue posible cargar el historial clinico.' });
          return of([]);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((entries) => {
        this.entries.set(entries);
      });
  }

  private buildSections(entries: ClinicalEntryVm[]): ClinicalHistorySectionVm[] {
    return [
      {
        title: 'Historia Odontologica',
        subtitle: 'Tratamientos, hallazgos, diagnosticos y seguimiento oral.',
        entries: entries.filter((entry) => entry.category === 'ODONTOLOGICAL')
      },
      {
        title: 'Historia Psicologica',
        subtitle: 'Evaluaciones, observaciones, intervenciones y evolucion emocional.',
        entries: entries.filter((entry) => entry.category === 'PSYCHOLOGICAL')
      },
      {
        title: 'Sin Categoria Definida',
        subtitle: 'Registros cuyo tipo no permite inferir si son odontologicos o psicologicos.',
        entries: entries.filter((entry) => entry.category === 'UNCLASSIFIED')
      }
    ].filter((section, index) => section.entries.length > 0 || index < 2);
  }
}

export const CLINICAL_HISTORY_ROUTES: Routes = [{ path: '', component: ClinicalHistoryPageComponent }];
