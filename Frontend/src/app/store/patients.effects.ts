import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import { PatientsApiService } from '../features/patients/data-access/patients-api.service';
import { loadPatients, loadPatientsFailure, loadPatientsSuccess } from './patients.actions';

@Injectable()
export class PatientsEffects {
  private readonly actions$ = inject(Actions);
  private readonly patientsApi = inject(PatientsApiService);

  load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadPatients),
      switchMap(() =>
        this.patientsApi.list$().pipe(
          map((items) => loadPatientsSuccess({ items })),
          catchError(() => of(loadPatientsFailure()))
        )
      )
    )
  );
}
