import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { selectPatient, syncPatientCatalog } from '../../store/patients.actions';
import { selectSelectedPatientId } from '../../store/patients.selectors';
import { extractHttpErrorMessage } from '../../core/http/extract-http-error-message';
import { PatientsApiService, PatientVm } from './data-access/patients-api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h5 class="card-title mb-0">Gestión de Pacientes</h5>
          <div class="d-flex flex-wrap align-items-center gap-2" role="search" aria-label="Buscar pacientes">
            <input
              class="form-control form-control-sm"
              style="min-width: 220px;"
              placeholder="Buscar nombre, correo, documento..."
              [(ngModel)]="search"
              (ngModelChange)="onSearchChange()"
              (keyup.enter)="reload()"
              aria-label="Texto de búsqueda" />
            <button
              type="button"
              class="btn btn-primary btn-sm"
              (click)="reload()"
              [disabled]="loading()">
              Buscar
            </button>
            <select
              class="form-select form-select-sm"
              style="width: 92px;"
              [(ngModel)]="size"
              (change)="reload()"
              aria-label="Tamaño de página">
              <option [ngValue]="25">25</option>
              <option [ngValue]="50">50</option>
              <option [ngValue]="100">100</option>
            </select>
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              (click)="prev()"
              [disabled]="page <= 0 || loading()">
              Anterior
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              (click)="next()"
              [disabled]="!hasNext() || loading()">
              Siguiente
            </button>
          </div>
        </div>

        @if (loadError()) {
          <div class="alert alert-danger py-2 d-flex flex-wrap align-items-center gap-2" role="alert">
            <span>{{ loadError() }}</span>
            <button type="button" class="btn btn-sm btn-outline-danger" (click)="load()">Reintentar</button>
          </div>
        }

        <p class="text-muted small mb-3" aria-live="polite">
          Página {{ page + 1 }} · {{ items().length }} de {{ total() | number }} pacientes
          @if (loading()) {
            <span class="spinner-border spinner-border-sm ms-1 align-middle" aria-hidden="true"></span>
            <span class="visually-hidden">Cargando</span>
          }
        </p>

        <div class="table-responsive position-relative" [attr.aria-busy]="loading()">
          @if (loading() && items().length === 0) {
            <div class="text-center py-5 text-muted">
              <div class="spinner-border text-primary mb-2" role="status"></div>
              <div>Cargando pacientes…</div>
            </div>
          } @else {
            <table class="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Paciente</th>
                  <th scope="col">Documento</th>
                  <th scope="col">Última consulta</th>
                  <th scope="col">Estado</th>
                  <th scope="col" class="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (patient of items(); track patient.id) {
                  <tr
                    tabindex="0"
                    role="button"
                    [attr.aria-selected]="selectedId() === patient.id"
                    (click)="onSelect(patient)"
                    (keydown.enter)="onSelect(patient)"
                    (keydown.space)="$event.preventDefault(); onSelect(patient)"
                    [class.table-active]="selectedId() === patient.id"
                    class="patient-row">
                    <td>{{ patient.name }}</td>
                    <td>{{ patient.document }}</td>
                    <td>{{ patient.lastVisit }}</td>
                    <td><span class="badge text-bg-success">{{ patient.status }}</span></td>
                    <td class="text-end" (click)="$event.stopPropagation()">
                      <button
                        type="button"
                        class="btn btn-outline-primary btn-sm"
                        [routerLink]="['/app/relapse']"
                        (click)="onSelect(patient)"
                        title="Ver riesgo de recaída y J48">
                        J48 / Riesgo
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                      @if (search.trim()) {
                        Sin resultados para «{{ search }}».
                      } @else {
                        Sin pacientes en esta página.
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
          @if (loading() && items().length > 0) {
            <div
              class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
              style="background: rgba(255,255,255,0.65); z-index: 2;">
              <div class="spinner-border text-primary" role="status" aria-label="Actualizando lista"></div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .patient-row {
      cursor: pointer;
    }
    .patient-row:focus-visible {
      outline: 2px solid var(--cop-brand, #0d6e6a);
      outline-offset: -2px;
    }
  `,
})
class PatientsPageComponent {
  private readonly store = inject(Store);
  private readonly api = inject(PatientsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchDebounced$ = new Subject<string>();

  protected page = 0;
  protected size = 50;
  protected search = '';
  protected readonly total = signal(0);
  protected readonly hasNext = signal(false);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly items = signal<PatientVm[]>([]);
  protected readonly selectedId = signal<string | null>(null);

  constructor() {
    this.store
      .select(selectSelectedPatientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => this.selectedId.set(id ?? null));

    this.searchDebounced$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload());

    this.load();
  }

  protected onSearchChange(): void {
    this.searchDebounced$.next(this.search);
  }

  protected reload(): void {
    this.page = 0;
    this.load();
  }

  protected prev(): void {
    if (this.page <= 0) return;
    this.page -= 1;
    this.load();
  }

  protected next(): void {
    if (!this.hasNext()) return;
    this.page += 1;
    this.load();
  }

  protected onSelect(patient: PatientVm): void {
    this.store.dispatch(selectPatient({ patientId: patient.id, patient }));
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.api.list$(this.page, this.size, this.search).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.hasNext.set(res.hasNext);
        this.loading.set(false);
        this.store.dispatch(syncPatientCatalog({ items: res.items }));
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(extractHttpErrorMessage(err, 'No se pudo cargar la lista de pacientes.'));
      },
    });
  }
}

export const PATIENTS_ROUTES: Routes = [{ path: '', component: PatientsPageComponent }];
