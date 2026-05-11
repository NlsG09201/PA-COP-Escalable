import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DASHBOARD_URL } from '../../../core/config/dashboard.config';

@Component({
  selector: 'app-public-site-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="landing-header">
      <div class="container d-flex flex-wrap justify-content-between align-items-center gap-3 py-3">
        <a class="brand-link" href="#hero">
          <img src="/brand/logo.png" alt="COP Centro Odontológico y Psicológico" class="brand-logo" width="48" height="48" loading="eager" />
          <span>
            <strong>Centro Odontologico y Psicologico</strong>
            <small>Atencion clinica privada</small>
          </span>
        </a>

        <nav class="landing-nav d-flex flex-wrap align-items-center gap-3">
          <a href="#services">Servicios</a>
          <a href="#gallery">Imágenes</a>
          <a href="#reviews">Reseñas</a>
          <a href="#pricing">Precios</a>
          <a href="#booking">Agendar</a>
          <a routerLink="/account" class="btn btn-outline-secondary btn-sm px-3">Mi cuenta</a>
          <a [href]="dashboardLoginUrl" class="btn btn-outline-primary btn-sm px-3">Ingreso profesional</a>
        </nav>
      </div>
    </header>
  `,
  styles: `
    .landing-header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(248, 250, 252, 0.9);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid rgba(15, 23, 42, 0.05);
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

    .landing-nav a {
      color: #334155;
      text-decoration: none;
      font-weight: 600;
    }
  `
})
export class PublicSiteHeaderComponent {
  protected readonly dashboardLoginUrl = `${DASHBOARD_URL}/login`;
}
