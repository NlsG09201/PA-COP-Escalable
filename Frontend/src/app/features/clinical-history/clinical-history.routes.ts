import { Component, inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { Store } from '@ngrx/store';
import { switchMap, catchError, of } from 'rxjs';
import { ClinicalHistoryApiService } from './data-access/clinical-history-api.service';
import { selectSelectedPatientId } from '../../store/patients.selectors';

@Component({
  standalone: true,
  imports: [AsyncPipe],
  template: `
    <div class="card">
      <div class="card-body">
        <h5 class="card-title mb-4">Historial Clinico</h5>
        <ul class="list-group">
          @for (entry of entries$ | async; track entry.date + entry.note) {
            <li class="list-group-item">{{ entry.date }} - {{ entry.note }}</li>
          }
        </ul>
      </div>
    </div>
  `
})
class ClinicalHistoryPageComponent {
  private readonly clinicalApi = inject(ClinicalHistoryApiService);
  private readonly store = inject(Store);
  protected readonly entries$ = this.store.select(selectSelectedPatientId).pipe(
    switchMap((patientId) =>
      patientId ? this.clinicalApi.listByPatient$(patientId).pipe(catchError(() => of([]))) : of([])
    )
  );
}

export const CLINICAL_HISTORY_ROUTES: Routes = [{ path: '', component: ClinicalHistoryPageComponent }];
