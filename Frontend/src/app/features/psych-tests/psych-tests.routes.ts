import { Component, inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { catchError, of } from 'rxjs';
import { PsychTestsApiService } from './data-access/psych-tests-api.service';

@Component({
  standalone: true,
  imports: [AsyncPipe],
  template: `
    <div class="card">
      <div class="card-body">
        <h5 class="card-title mb-3">Tests Psicologicos</h5>
        <div class="row g-3">
          @for (test of templates$ | async; track test.id) {
            <div class="col-md-6">
              <div class="border rounded p-3">
                <h6>{{ test.name }}</h6>
                <p class="text-muted mb-2">{{ test.type }}</p>
                <button class="btn btn-primary btn-sm">Aplicar Test</button>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
class PsychTestsPageComponent {
  private readonly testsApi = inject(PsychTestsApiService);
  protected readonly templates$ = this.testsApi.templates$().pipe(catchError(() => of([])));
}

export const PSYCH_TESTS_ROUTES: Routes = [{ path: '', component: PsychTestsPageComponent }];
