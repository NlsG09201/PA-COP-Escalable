import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-public-site-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="landing-header">
      <div class="container d-flex flex-wrap justify-content-between align-items-center gap-3 py-3">
        <a class="brand-link" href="#hero">
          <span class="brand-badge">COP</span>
          <span>
            <strong>Centro Odontologico y Psicologico</strong>
            <small>Atencion clinica privada</small>
          </span>
        </a>

        <nav class="landing-nav d-flex flex-wrap align-items-center gap-3">
          <a href="#services">Servicios</a>
          <a href="#pricing">Precios</a>
          <a href="#booking">Agendar</a>
          <a [routerLink]="'/login'" class="btn btn-outline-primary btn-sm px-3">Ingreso profesional</a>
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

    .brand-badge {
      width: 2.75rem;
      height: 2.75rem;
      border-radius: 0.95rem;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
      color: #fff;
      font-weight: 800;
    }

    .landing-nav a {
      color: #334155;
      text-decoration: none;
      font-weight: 600;
    }
  `
})
export class PublicSiteHeaderComponent {}
