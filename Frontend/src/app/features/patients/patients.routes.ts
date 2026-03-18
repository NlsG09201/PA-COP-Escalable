import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import { loadPatients, selectPatient } from '../../store/patients.actions';
import { selectPatients, selectSelectedPatientId } from '../../store/patients.selectors';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="card-body">
        <h5 class="card-title mb-3">Gestion de Pacientes</h5>
        <div class="table-responsive">
          <table class="table table-hover align-middle">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Documento</th>
                <th>Ultima Consulta</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (patient of patients$ | async; track patient.document) {
                <tr
                  (click)="onSelect(patient.id)"
                  [class.table-active]="(selectedPatientId$ | async) === patient.id"
                  style="cursor: pointer">
                  <td>{{ patient.name }}</td>
                  <td>{{ patient.document }}</td>
                  <td>{{ patient.lastVisit }}</td>
                  <td><span class="badge text-bg-success">{{ patient.status }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
class PatientsPageComponent {
  private readonly store = inject(Store);
  protected readonly patients$ = this.store.select(selectPatients);
  protected readonly selectedPatientId$ = this.store.select(selectSelectedPatientId);

  constructor() {
    this.store.dispatch(loadPatients());
  }

  protected onSelect(patientId: string): void {
    this.store.dispatch(selectPatient({ patientId }));
  }
}

export const PATIENTS_ROUTES: Routes = [{ path: '', component: PatientsPageComponent }];
