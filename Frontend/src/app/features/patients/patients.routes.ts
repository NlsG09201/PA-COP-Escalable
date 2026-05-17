import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectPatient } from '../../store/patients.actions';
import { selectSelectedPatientId } from '../../store/patients.selectors';
import { PatientsApiService, PatientVm } from './data-access/patients-api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h5 class="card-title mb-0">Gestión de Pacientes</h5>
          <div class="d-flex flex-wrap align-items-center gap-2">
            <input
              class="form-control form-control-sm"
              style="min-width: 220px;"
              placeholder="Buscar nombre, correo, documento..."
              [(ngModel)]="search"
              (keyup.enter)="reload()" />
            <select class="form-select form-select-sm" style="width: 92px;" [(ngModel)]="size" (change)="reload()">
              <option [ngValue]="25">25</option>
              <option [ngValue]="50">50</option>
              <option [ngValue]="100">100</option>
            </select>
            <button class="btn btn-outline-secondary btn-sm" (click)="prev()" [disabled]="page <= 0">Anterior</button>
            <button class="btn btn-outline-secondary btn-sm" (click)="next()" [disabled]="!hasNext()">Siguiente</button>
          </div>
        </div>

        <p class="text-muted small mb-3">
          Página {{ page + 1 }} · {{ items().length }} de {{ total() | number }} pacientes
          @if (loading()) { · cargando... }
        </p>

        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Documento</th>
                <th>Última consulta</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (patient of items(); track patient.id) {
                <tr
                  (click)="onSelect(patient.id)"
                  [class.table-active]="selectedId() === patient.id"
                  style="cursor: pointer">
                  <td>{{ patient.name }}</td>
                  <td>{{ patient.document }}</td>
                  <td>{{ patient.lastVisit }}</td>
                  <td><span class="badge text-bg-success">{{ patient.status }}</span></td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="text-center text-muted py-4">Sin pacientes en esta página.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
class PatientsPageComponent {
  private readonly store = inject(Store);
  private readonly api = inject(PatientsApiService);

  protected page = 0;
  protected size = 50;
  protected search = '';
  protected readonly total = signal(0);
  protected readonly hasNext = signal(false);
  protected readonly loading = signal(false);
  protected readonly items = signal<PatientVm[]>([]);
  protected readonly selectedId = signal<string | null>(null);

  constructor() {
    this.store.select(selectSelectedPatientId).subscribe((id) => this.selectedId.set(id ?? null));
    this.reload();
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

  protected onSelect(patientId: string): void {
    this.store.dispatch(selectPatient({ patientId }));
  }

  private load(): void {
    this.loading.set(true);
    this.api.list$(this.page, this.size, this.search).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.hasNext.set(res.hasNext);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}

export const PATIENTS_ROUTES: Routes = [{ path: '', component: PatientsPageComponent }];


