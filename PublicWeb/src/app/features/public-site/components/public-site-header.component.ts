import { AsyncPipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DASHBOARD_URL } from '../../../core/config/dashboard.config';
import { AuthService } from '../../../core/auth/auth.service';

const STAFF_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL']);

@Component({
  selector: 'app-public-site-header',
  standalone: true,
  imports: [AsyncPipe, CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="landing-header">
      <div class="container d-flex flex-wrap justify-content-between align-items-center gap-3 py-3">
        <a class="brand-link" href="#hero">
          <img src="/brand/logo.png" alt="COP Centro Odontológico y Psicológico" class="brand-logo" width="48" height="48" loading="eager" />
          <span>
            <strong>Centro Odontologico y Psicologico</strong>
            <small>Atención clínica integral · Colombia</small>
          </span>
        </a>

        <nav class="landing-nav d-flex flex-wrap align-items-center gap-2 gap-md-3">
          <a href="#about">Nosotros</a>
          <a href="#services">Servicios</a>
          <a href="#gallery">Galería</a>
          <a href="#reviews">Reseñas</a>
          <a href="#pricing">Precios</a>
          <a href="#booking" class="nav-cta">Agendar</a>
          <a routerLink="/account" class="btn btn-outline-secondary btn-sm px-3">Mi cuenta</a>
          @if (showDashboardLink$ | async) {
            <a [href]="dashboardLoginUrl" class="btn btn-outline-primary btn-sm px-3">Ingreso profesional</a>
          }
        </nav>
      </div>
    </header>
  `,
  styles: `
    .landing-header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(248, 250, 252, 0.92);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(15, 23, 42, 0.06);
      box-shadow: 0 8px 32px rgba(15, 23, 42, 0.04);
    }

    .brand-link {
      display: inline-flex;
      align-items: center;
      gap: 0.85rem;
      color: inherit;
      text-decoration: none;
    }

    .brand-link small {
      display: block;
      color: #64748b;
      font-size: 0.82rem;
    }

    .brand-logo {
      flex-shrink: 0;
      border-radius: 0.95rem;
      object-fit: cover;
      border: 1px solid rgba(148, 163, 184, 0.25);
      background: #fff;
    }

    .landing-nav a:not(.btn) {
      color: #334155;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.92rem;
    }

    .nav-cta {
      color: #1d4ed8 !important;
    }
  `,
})
export class PublicSiteHeaderComponent {
  private readonly auth = inject(AuthService);
  protected readonly dashboardLoginUrl = `${DASHBOARD_URL}/login`;

  protected readonly showDashboardLink$ = this.auth.current$().pipe(
    map((me) => {
      if (!me) return true;
      const roles = me.roles ?? [];
      if (roles.some((r) => STAFF_ROLES.has(r))) return true;
      return !roles.includes('PACIENTE');
    }),
  );
}
