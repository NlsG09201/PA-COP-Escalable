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
  { path: '**', redirectTo: 'login' }
];
