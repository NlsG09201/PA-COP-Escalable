import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { PatientsApiService } from '../features/patients/data-access/patients-api.service';
import { persistPatientSelection } from './patients-persist.util';
import { loadPatients, loadPatientsFailure, loadPatientsSuccess, selectPatient } from './patients.actions';

@Injectable()
export class PatientsEffects {
  private readonly actions$ = inject(Actions);
  private readonly patientsApi = inject(PatientsApiService);

  load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadPatients),
      switchMap(() =>
        this.patientsApi.list$(0, 200).pipe(
          map((page) => loadPatientsSuccess({ items: page.items })),
          catchError(() => of(loadPatientsFailure())),
        ),
      ),
    ),
  );

  persistSelection$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(selectPatient),
        tap(({ patientId, patient }) => {
          persistPatientSelection(patientId, patient ?? null);
        }),
      ),
    { dispatch: false },
  );
}
