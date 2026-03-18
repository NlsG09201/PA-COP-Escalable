import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UserRole } from '../models/user-role.model';
import { AuthService } from '../services/auth.service';
import { AuthApiService } from '../services/auth-api.service';

type NavItem = {
  label: string;
  path: string;
  roles: UserRole[];
};

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell-layout">
      <aside class="shell-sidebar border-end bg-white">
        <div class="p-3 border-bottom fw-semibold">COP Clinical Dashboard</div>
        <nav class="nav flex-column gap-1 p-2">
          @for (item of visibleItems(); track item.path) {
            <a
              class="nav-link rounded-2"
              [routerLink]="item.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: false }">
              {{ item.label }}
            </a>
          }
        </nav>
      </aside>

      <div class="shell-main">
        <header class="navbar navbar-expand navbar-light bg-white border-bottom px-3">
          <span class="navbar-brand mb-0 h6">Panel Administrativo Clinico</span>
          <div class="ms-auto d-flex align-items-center gap-3">
            <span class="text-muted small">Rol activo: {{ role() }}</span>
            <button class="btn btn-outline-secondary btn-sm" (click)="logout()">Salir</button>
          </div>
        </header>

        <main class="p-3 p-md-4">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: `
    .shell-layout {
      display: grid;
      grid-template-columns: 270px 1fr;
      min-height: 100vh;
    }

    .shell-sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
    }

    .shell-main {
      min-width: 0;
    }

    .nav-link.active {
      background-color: #f0f4ff;
      color: #1f3bb3;
      font-weight: 600;
    }

    @media (max-width: 1024px) {
      .shell-layout {
        grid-template-columns: 1fr;
      }

      .shell-sidebar {
        position: relative;
        height: auto;
      }
    }
  `
})
export class AppShellComponent {
  private readonly allItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', roles: ['ADMIN', 'DENTIST', 'PSYCHOLOGIST'] },
    { label: 'Gestion de Citas', path: '/appointments', roles: ['ADMIN', 'DENTIST', 'PSYCHOLOGIST'] },
    { label: 'Pacientes', path: '/patients', roles: ['ADMIN', 'DENTIST', 'PSYCHOLOGIST'] },
    { label: 'Odontograma', path: '/odontogram', roles: ['ADMIN', 'DENTIST'] },
    { label: 'Historial Clinico', path: '/clinical-history', roles: ['ADMIN', 'DENTIST', 'PSYCHOLOGIST'] },
    { label: 'Modulo Psicologico', path: '/psychology', roles: ['ADMIN', 'PSYCHOLOGIST'] },
    { label: 'Tests Psicologicos', path: '/psych-tests', roles: ['ADMIN', 'PSYCHOLOGIST'] }
  ];

  protected readonly role = signal<UserRole>('ADMIN');
  protected readonly visibleItems = computed(() =>
    this.allItems.filter((item) => item.roles.includes(this.role()))
  );

  constructor(
    authService: AuthService,
    private readonly authApi: AuthApiService,
    private readonly router: Router
  ) {
    this.role.set(authService.getRole());
  }

  protected logout(): void {
    this.authApi.logout();
    this.router.navigateByUrl('/login');
  }
}
