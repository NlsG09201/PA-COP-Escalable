import { Component } from '@angular/core';
import { Routes } from '@angular/router';

@Component({
  standalone: true,
  template: `
    <div class="row g-3">
      <div class="col-md-4">
        <div class="card">
          <div class="card-body">
            <h6 class="text-muted">Citas de Hoy</h6>
            <h3>42</h3>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card">
          <div class="card-body">
            <h6 class="text-muted">Pacientes Activos</h6>
            <h3>318</h3>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card">
          <div class="card-body">
            <h6 class="text-muted">Tests Pendientes</h6>
            <h3>15</h3>
          </div>
        </div>
      </div>
    </div>
  `
})
class DashboardPageComponent {}

export const DASHBOARD_ROUTES: Routes = [{ path: '', component: DashboardPageComponent }];
