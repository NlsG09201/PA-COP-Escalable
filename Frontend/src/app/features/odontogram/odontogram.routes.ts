import { Component, inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { Store } from '@ngrx/store';
import { switchMap, catchError, of } from 'rxjs';
import { OdontogramApiService } from './data-access/odontogram-api.service';
import { selectSelectedPatientId } from '../../store/patients.selectors';

@Component({
  standalone: true,
  imports: [AsyncPipe],
  template: `
    <div class="card">
      <div class="card-body">
        <h5 class="card-title mb-3">Odontograma Interactivo</h5>
        <svg viewBox="0 0 500 180" class="w-100 border rounded p-3 bg-light">
          <rect x="20" y="40" width="40" height="40" rx="6" fill="#cfe2ff" />
          <rect x="70" y="40" width="40" height="40" rx="6" fill="#ffc9c9" />
          <rect x="120" y="40" width="40" height="40" rx="6" fill="#d3f9d8" />
          <rect x="170" y="40" width="40" height="40" rx="6" fill="#cfe2ff" />
          <text x="20" y="120" fill="#495057">Base visual para evolucion por pieza dental</text>
        </svg>
        <ul class="list-group mt-3">
          @for (item of states$ | async; track item.tooth) {
            <li class="list-group-item">Pieza {{ item.tooth }}: {{ item.state }}</li>
          }
        </ul>
      </div>
    </div>
  `
})
class OdontogramPageComponent {
  private readonly odontogramApi = inject(OdontogramApiService);
  private readonly store = inject(Store);
  protected readonly states$ = this.store.select(selectSelectedPatientId).pipe(
    switchMap((patientId) =>
      patientId ? this.odontogramApi.getByPatient$(patientId).pipe(catchError(() => of([]))) : of([])
    )
  );
}

export const ODONTOGRAM_ROUTES: Routes = [{ path: '', component: OdontogramPageComponent }];
