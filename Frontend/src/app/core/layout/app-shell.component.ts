import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { UserRole } from '../models/user-role.model';
import { AuthService } from '../services/auth.service';
import { AuthApiService } from '../services/auth-api.service';
import { selectSelectedPatient } from '../../store/patients.selectors';

type NavItem = {
  label: string;
  path: string;
  roles: UserRole[];
};

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [AsyncPipe, CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell-layout" data-testid="app-shell">
      <aside class="shell-sidebar" data-testid="app-shell-sidebar">
        <div class="brand-block">
          <p class="brand-eyebrow mb-2">Centro Odontologico y Psicologico</p>
          <div class="fw-semibold fs-5">COP Clinical Dashboard</div>
          <p class="text-white-50 small mb-0">Operacion clinica, evaluacion psicologica y seguimiento por paciente.</p>
        </div>

        <nav class="nav-section" data-testid="app-shell-nav">
          <span class="nav-caption">Navegacion principal</span>
          @for (item of visibleItems(); track item.path) {
            <a
              class="nav-link rounded-3"
              [attr.data-testid]="'nav-link-' + item.path.replace('/app/', '')"
              [routerLink]="item.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: false }">
              <span class="nav-link-text">{{ item.label }}</span>
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          <span class="footer-label">Rol activo</span>
          <strong>{{ role() }}</strong>
        </div>
      </aside>

      <div class="shell-main">
        <header class="shell-header" data-testid="app-shell-header">
          <div>
            <span class="navbar-brand mb-0 h6 d-block">Panel Administrativo Clinico</span>
            <span class="text-muted small">Interfaz operativa para atencion dental y psicologica.</span>
          </div>

          <div class="header-actions">
            <div class="patient-chip">
              <span class="footer-label">Paciente activo</span>
              <strong>{{ (selectedPatient$ | async)?.name ?? 'Sin seleccion' }}</strong>
            </div>
            <button class="btn btn-outline-secondary btn-sm" data-testid="logout-button" (click)="logout()">Salir</button>
          </div>
        </header>

        <main class="shell-content p-3 p-md-4">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: `
    .shell-layout {
      display: grid;
      grid-template-columns: 300px 1fr;
      min-height: 100vh;
      background: #f4f7fb;
    }

    .shell-sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
      padding: 1.25rem 1rem;
      background: linear-gradient(180deg, #0f172a 0%, #172554 100%);
      color: #fff;
    }

    .brand-block {
      border-radius: 24px;
      padding: 1.25rem;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      margin-bottom: 1rem;
      backdrop-filter: blur(8px);
    }

    .brand-eyebrow,
    .nav-caption,
    .footer-label {
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
    }

    .nav-section {
      display: grid;
      gap: 0.5rem;
    }

    .nav-link {
      display: flex;
      align-items: center;
      padding: 0.85rem 1rem;
      color: rgba(255, 255, 255, 0.88);
      border: 1px solid transparent;
      transition: background-color 150ms ease, border-color 150ms ease, transform 150ms ease;
    }

    .nav-link:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.08);
      transform: translateX(2px);
    }

    .nav-link.active {
      background: rgba(255, 255, 255, 0.16);
      border-color: rgba(191, 219, 254, 0.35);
      color: #fff;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
      font-weight: 700;
    }

    .shell-main {
      min-width: 0;
      display: grid;
      grid-template-rows: auto 1fr;
    }

    .shell-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.5rem;
      background: rgba(255, 255, 255, 0.9);
      border-bottom: 1px solid #eaeef5;
      backdrop-filter: blur(10px);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .patient-chip,
    .sidebar-footer {
      display: grid;
      gap: 0.15rem;
      padding: 0.85rem 1rem;
      border-radius: 18px;
    }

    .patient-chip {
      background: #f8fafc;
      border: 1px solid #e9eef5;
      min-width: 210px;
    }

    .sidebar-footer {
      margin-top: 1.5rem;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
    }

    .shell-content {
      min-width: 0;
    }

    @media (max-width: 1024px) {
      .shell-layout {
        grid-template-columns: 1fr;
      }

      .shell-sidebar {
        position: relative;
        height: auto;
      }

      .shell-header,
      .header-actions {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `
})
export class AppShellComponent {
  private readonly store = inject(Store);
  private readonly allItems: NavItem[] = [
    { label: 'Dashboard', path: '/app/dashboard', roles: ['ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL'] },
    { label: 'Catalogo de Servicios', path: '/app/services', roles: ['ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL'] },
    { label: 'Gestion de Citas', path: '/app/appointments', roles: ['ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL'] },
    { label: 'Pacientes', path: '/app/patients', roles: ['ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL'] },
    { label: 'Odontograma', path: '/app/odontogram', roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] },
    { label: 'Diagnostico IA', path: '/app/diagnosis', roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] },
    { label: 'Simulacion 3D', path: '/app/simulation', roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] },
    { label: 'Presupuestos', path: '/app/budget', roles: ['ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL'] },
    { label: 'Seguimiento', path: '/app/followup', roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] },
    { label: 'Historial Clinico', path: '/app/clinical-history', roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] },
    { label: 'Modulo Psicologico', path: '/app/psychology', roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] },
    { label: 'Analisis de Voz', path: '/app/voice-analysis', roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] },
    { label: 'Terapia Digital', path: '/app/therapy', roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] },
    { label: 'Riesgo de Recaida', path: '/app/relapse', roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] },
    { label: 'Tests Psicologicos', path: '/app/psych-tests', roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] },
    { label: 'Copiloto Clinico', path: '/app/copilot', roles: ['ADMIN', 'MEDICO', 'PROFESSIONAL'] },
    { label: 'Experiencia Paciente', path: '/app/experience', roles: ['ADMIN', 'ORG_ADMIN', 'SITE_ADMIN'] }
  ];

  protected readonly activeRoles = signal<UserRole[]>(['ADMIN']);
  protected readonly role = computed(() => this.activeRoles()[0] ?? 'ADMIN');
  protected readonly selectedPatient$ = this.store.select(selectSelectedPatient);
  protected readonly visibleItems = computed(() =>
    this.allItems.filter((item) => item.roles.some((role) => this.activeRoles().includes(role)))
  );

  constructor(
    authService: AuthService,
    private readonly authApi: AuthApiService,
    private readonly router: Router
  ) {
    this.activeRoles.set(authService.getRoles());
  }

  protected logout(): void {
    this.authApi.logout();
    this.router.navigateByUrl('/login');
  }
}
