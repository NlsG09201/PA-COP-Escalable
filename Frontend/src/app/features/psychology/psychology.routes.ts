import { Component } from '@angular/core';
import { Routes } from '@angular/router';

@Component({
  standalone: true,
  template: `
    <div class="card">
      <div class="card-body">
        <h5 class="card-title mb-3">Modulo Psicologico</h5>
        <form class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Paciente</label>
            <input class="form-control" placeholder="Selecciona paciente" />
          </div>
          <div class="col-md-6">
            <label class="form-label">Sesion</label>
            <input class="form-control" placeholder="Objetivo de sesion" />
          </div>
          <div class="col-12">
            <label class="form-label">Notas Clinicas</label>
            <textarea class="form-control" rows="4"></textarea>
          </div>
        </form>
      </div>
    </div>
  `
})
class PsychologyPageComponent {}

export const PSYCHOLOGY_ROUTES: Routes = [{ path: '', component: PsychologyPageComponent }];
