import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DASHBOARD_URL } from '../../../core/config/dashboard.config';

@Component({
  selector: 'app-public-site-footer',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="site-footer" aria-label="Pie de página">
      <div class="container">
        <div class="row g-4 g-lg-5">
          <div class="col-lg-4">
            <a routerLink="/" class="footer-brand">
              <img src="/brand/logo.png" alt="" width="44" height="44" class="footer-logo" />
              <span>
                <strong>Centro COP</strong>
                <small>Odontología y psicología · Colombia</small>
              </span>
            </a>
            <p class="footer-tagline">
              Atención clínica integral con reserva en línea, sedes en todo el país y seguimiento profesional.
            </p>
          </div>

          <div class="col-6 col-md-4 col-lg-2">
            <h3 class="footer-heading">Explorar</h3>
            <ul class="footer-links">
              <li><a href="#about">Nosotros</a></li>
              <li><a href="#services">Servicios</a></li>
              <li><a href="#gallery">Galería</a></li>
              <li><a href="#pricing">Precios</a></li>
              <li><a href="#booking">Reservar</a></li>
            </ul>
          </div>

          <div class="col-6 col-md-4 col-lg-3">
            <h3 class="footer-heading">Cuenta</h3>
            <ul class="footer-links">
              <li><a routerLink="/login">Iniciar sesión</a></li>
              <li><a routerLink="/register">Crear cuenta</a></li>
              <li><a routerLink="/account">Mi perfil</a></li>
            </ul>
          </div>

          <div class="col-md-4 col-lg-3">
            <h3 class="footer-heading">Profesionales</h3>
            <ul class="footer-links">
              <li><a [href]="dashboardUrl + '/login'">Panel clínico</a></li>
            </ul>
          </div>
        </div>

        <div class="footer-bottom">
          <span>© {{ year }} Centro Odontológico y Psicológico COP</span>
          <span class="footer-bottom-note">Información orientativa · No sustituye valoración médica presencial</span>
        </div>
      </div>
    </footer>
  `,
  styles: `
    .site-footer {
      margin-top: auto;
      padding-block: clamp(2.5rem, 5vw, 3.5rem);
      background: linear-gradient(180deg, var(--cop-surface-elevated) 0%, #f3f1ed 100%);
      border-top: 1px solid var(--cop-border);
    }

    .footer-brand {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      color: inherit;
      margin-bottom: 0.85rem;
    }

    .footer-brand strong {
      display: block;
      font-weight: 700;
      color: var(--cop-ink);
    }

    .footer-brand small {
      color: var(--cop-ink-muted);
      font-size: 0.82rem;
    }

    .footer-logo {
      border-radius: 0.85rem;
      border: 1px solid var(--cop-border);
    }

    .footer-tagline {
      color: var(--cop-ink-muted);
      font-size: 0.95rem;
      line-height: 1.55;
      max-width: 22rem;
      margin: 0;
    }

    .footer-heading {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--cop-brand-dark);
      margin: 0 0 0.85rem;
    }

    .footer-links {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 0.45rem;
    }

    .footer-links a {
      color: var(--cop-ink-muted);
      text-decoration: none;
      font-size: 0.92rem;
      font-weight: 500;
      transition: color 0.15s ease;
    }

    .footer-links a:hover {
      color: var(--cop-brand);
    }

    .footer-bottom {
      margin-top: 2rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--cop-border);
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 0.5rem 1rem;
      font-size: 0.82rem;
      color: var(--cop-ink-subtle);
    }

    .footer-bottom-note {
      text-align: right;
    }

    @media (max-width: 575px) {
      .footer-bottom-note {
        text-align: left;
      }
    }
  `,
})
export class PublicSiteFooterComponent {
  protected readonly year = new Date().getFullYear();
  protected readonly dashboardUrl = DASHBOARD_URL;
}
