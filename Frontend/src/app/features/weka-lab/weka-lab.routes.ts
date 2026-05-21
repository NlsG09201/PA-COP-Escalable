import { Component } from '@angular/core';
import { Routes } from '@angular/router';
import { DASHBOARD_NEXT_URL, WEKA_AI_LAB_URL } from '../../core/config/dashboard-next.config';

@Component({
  standalone: true,
  template: `
    <div class="card shadow-sm border-0">
      <div class="card-body p-4">
        <h4 class="mb-2">Weka AI Lab</h4>
        <p class="text-muted mb-3">
          El laboratorio Weka (árbol J48, entrenamiento, validación y predicción clínica) vive en el panel
          Next.js. Este enlace abre la pestaña completa con la misma sesión del API en Render.
        </p>
        <div class="d-flex flex-wrap gap-2">
          <a class="btn btn-primary" [href]="wekaUrl" target="_blank" rel="noopener noreferrer">
            Abrir Weka AI Lab
          </a>
          <a class="btn btn-outline-secondary" [href]="dashboardUrl" target="_blank" rel="noopener noreferrer">
            Panel Next.js completo
          </a>
        </div>
        <p class="small text-muted mt-3 mb-0">
          Si el enlace no carga, despliega <code>cop-web-dashboard</code> en Render y define
          <code>DASHBOARD_URL</code> en Vercel (Frontend).
        </p>
      </div>
    </div>
  `,
})
class WekaLabLauncherComponent {
  protected readonly wekaUrl = WEKA_AI_LAB_URL;
  protected readonly dashboardUrl = DASHBOARD_NEXT_URL;
}

export const WEKA_LAB_ROUTES: Routes = [{ path: '', component: WekaLabLauncherComponent }];
