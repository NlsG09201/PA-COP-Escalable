import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { AppShellComponent } from './core/layout/app-shell.component';
import { LoginComponent } from './features/auth/login.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  {
    path: 'app',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        canActivate: [roleGuard],
        loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
        data: { roles: ['ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL'] }
      },
      {
        path: 'services',
        canActivate: [roleGuard],
        loadChildren: () => import('./features/services/services.routes').then((m) => m.SERVICES_ROUTES),
        data: { roles: ['ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL'] }
      },
      {
        path: 'appointments',
        canActivate: [roleGuard],
        loadChildren: () => import('./features/appointments/appointments.routes').then((m) => m.APPOINTMENTS_ROUTES),
        data: { roles: ['ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL'] }
      },
      {
        path: 'patients',
        canActivate: [roleGuard],
        loadChildren: () => import('./features/patients/patients.routes').then((m) => m.PATIENTS_ROUTES),
        data: { roles: ['ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL'] }
      },
      {
        path: 'odontogram',
        canActivate: [roleGuard],
        loadChildren: () => import('./features/odontogram/odontogram.routes').then((m) => m.ODONTOGRAM_ROUTES),
        data: { roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] }
      },
      {
        path: 'clinical-history',
        canActivate: [roleGuard],
        loadChildren: () => import('./features/clinical-history/clinical-history.routes').then((m) => m.CLINICAL_HISTORY_ROUTES),
        data: { roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] }
      },
      {
        path: 'psychology',
        canActivate: [roleGuard],
        loadChildren: () => import('./features/psychology/psychology.routes').then((m) => m.PSYCHOLOGY_ROUTES),
        data: { roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] }
      },
      {
        path: 'psych-tests',
        canActivate: [roleGuard],
        loadChildren: () => import('./features/psych-tests/psych-tests.routes').then((m) => m.PSYCH_TESTS_ROUTES),
        data: { roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] }
      },
      {
        path: 'diagnosis',
        canActivate: [roleGuard],
        loadChildren: () => import('./features/diagnosis/diagnosis.routes').then((m) => m.DIAGNOSIS_ROUTES),
        data: { roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] }
      },
      {
        path: 'simulation',
        canActivate: [roleGuard],
        loadChildren: () => import('./features/simulation/simulation.routes').then((m) => m.SIMULATION_ROUTES),
        data: { roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] }
      },
      {
        path: 'budget',
        canActivate: [roleGuard],
        loadChildren: () => import('./features/budget/budget.routes').then((m) => m.BUDGET_ROUTES),
        data: { roles: ['ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL'] }
      },
      {
        path: 'followup',
        canActivate: [roleGuard],
        loadChildren: () => import('./features/followup/followup.routes').then((m) => m.FOLLOWUP_ROUTES),
        data: { roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] }
      },
      {
        path: 'therapy',
        canActivate: [roleGuard],
        loadChildren: () => import('./features/therapy/therapy.routes').then((m) => m.THERAPY_ROUTES),
        data: { roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] }
      },
      {
        path: 'copilot',
        canActivate: [roleGuard],
        loadChildren: () => import('./features/copilot/copilot.routes').then((m) => m.COPILOT_ROUTES),
        data: { roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] }
      },
      {
        path: 'experience',
        canActivate: [roleGuard],
        loadChildren: () => import('./features/experience/experience.routes').then((m) => m.EXPERIENCE_ROUTES),
        data: { roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] }
      },
      {
        path: 'voice-analysis',
        canActivate: [roleGuard],
        loadChildren: () => import('./features/voice-analysis/voice-analysis.routes').then((m) => m.VOICE_ANALYSIS_ROUTES),
        data: { roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] }
      },
      {
        path: 'relapse',
        canActivate: [roleGuard],
        loadChildren: () => import('./features/relapse/relapse.routes').then((m) => m.RELAPSE_ROUTES),
        data: { roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] }
      }
    ]
  },
  { path: 'dashboard', pathMatch: 'full', redirectTo: 'app/dashboard' },
  { path: 'services', pathMatch: 'full', redirectTo: 'app/services' },
  { path: 'appointments', pathMatch: 'full', redirectTo: 'app/appointments' },
  { path: 'patients', pathMatch: 'full', redirectTo: 'app/patients' },
  { path: 'odontogram', pathMatch: 'full', redirectTo: 'app/odontogram' },
  { path: 'clinical-history', pathMatch: 'full', redirectTo: 'app/clinical-history' },
  { path: 'psychology', pathMatch: 'full', redirectTo: 'app/psychology' },
  { path: 'psych-tests', pathMatch: 'full', redirectTo: 'app/psych-tests' },
  { path: 'diagnosis', pathMatch: 'full', redirectTo: 'app/diagnosis' },
  { path: 'simulation', pathMatch: 'full', redirectTo: 'app/simulation' },
  { path: 'budget', pathMatch: 'full', redirectTo: 'app/budget' },
  { path: 'followup', pathMatch: 'full', redirectTo: 'app/followup' },
  { path: 'therapy', pathMatch: 'full', redirectTo: 'app/therapy' },
  { path: 'copilot', pathMatch: 'full', redirectTo: 'app/copilot' },
  { path: 'experience', pathMatch: 'full', redirectTo: 'app/experience' },
  { path: 'voice-analysis', pathMatch: 'full', redirectTo: 'app/voice-analysis' },
  { path: 'relapse', pathMatch: 'full', redirectTo: 'app/relapse' },
  { path: '**', redirectTo: 'login' }
];
