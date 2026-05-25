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
        <a class="brand-link" routerLink="/" fragment="hero">
          <img src="/brand/logo.png" alt="COP Centro Odontológico y Psicológico" class="brand-logo" width="48" height="48" loading="eager" />
          <span class="brand-text">
            <strong>Centro COP</strong>
            <small class="d-none d-sm-block">Odontología y psicología · Colombia</small>
          </span>
        </a>

        <nav class="landing-nav d-none d-lg-flex flex-wrap align-items-center gap-2 gap-md-3" aria-label="Principal">
          <a href="#about">Nosotros</a>
          <a href="#schedule">Horarios</a>
          <a href="#services">Servicios</a>
          <a href="#gallery">Galería</a>
          <a href="#reviews">Reseñas</a>
          <a href="#pricing">Precios</a>
          <a href="#booking" class="btn btn-primary btn-sm nav-cta px-3">Agendar cita</a>
          @if (me$ | async; as me) {
            <a routerLink="/account" class="btn btn-outline-primary btn-sm px-3 nav-user">
              {{ me.profile?.fullName?.trim() || me.username }}
            </a>
          } @else {
            <a routerLink="/login" class="btn btn-outline-secondary btn-sm px-3">Iniciar sesión</a>
            <a routerLink="/register" class="btn btn-outline-primary btn-sm px-3 d-none d-md-inline-flex">Registrarse</a>
          }
          @if (showDashboardLink$ | async) {
            <a [href]="dashboardLoginUrl" class="btn btn-link btn-sm px-2 text-muted d-none d-lg-inline">Profesional</a>
          }
        </nav>
      </div>
      <nav class="landing-nav-mobile d-lg-none container pb-2" aria-label="Navegación móvil">
        <a href="#about">Nosotros</a>
        <a href="#schedule">Horarios</a>
        <a href="#services">Servicios</a>
        <a href="#booking">Reservar</a>
        <a href="#reviews">Reseñas</a>
      </nav>
    </header>
  `,
  styles: `
    .landing-header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(250, 249, 247, 0.94);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--cop-border, rgba(15, 28, 30, 0.08));
      box-shadow: var(--cop-shadow-sm, 0 4px 20px rgba(15, 28, 30, 0.04));
    }

    .landing-header::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 2px;
      background: linear-gradient(90deg, var(--cop-brand) 0%, var(--cop-accent) 50%, transparent 100%);
      opacity: 0.65;
    }

    .brand-link {
      display: inline-flex;
      align-items: center;
      gap: 0.85rem;
      color: inherit;
      text-decoration: none;
    }

    .brand-text strong {
      font-weight: 700;
      color: var(--cop-ink, #0f1c1e);
      letter-spacing: -0.02em;
      font-size: 1.05rem;
    }

    .brand-link small {
      display: block;
      color: var(--cop-ink-muted, #5c6b6e);
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
      color: var(--cop-ink-muted, #5c6b6e);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.92rem;
      transition: color 0.15s ease;
    }

    .landing-nav a:not(.btn):hover {
      color: var(--cop-brand, #0d6e6a);
    }

    .nav-cta {
      margin-left: 0.25rem;
    }

    .landing-nav-mobile {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 0.85rem;
      border-top: 1px solid var(--cop-border);
      padding-top: 0.65rem;
    }

    .landing-nav-mobile a {
      color: var(--cop-ink-muted);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .landing-nav-mobile a:hover {
      color: var(--cop-brand);
    }
  `,
})
export class PublicSiteHeaderComponent {
  private readonly auth = inject(AuthService);
  protected readonly dashboardLoginUrl = `${DASHBOARD_URL}/login`;
  protected readonly me$ = this.auth.current$();

  protected readonly showDashboardLink$ = this.auth.current$().pipe(
    map((me) => {
      if (!me) return true;
      const roles = me.roles ?? [];
      if (roles.some((r) => STAFF_ROLES.has(r))) return true;
      return !roles.includes('PACIENTE');
    }),
  );
}
