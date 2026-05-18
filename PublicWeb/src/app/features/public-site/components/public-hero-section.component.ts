import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-public-hero-section',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="hero" class="hero-section" aria-label="Presentación Centro COP">
      <div class="hero-visual">
        <img
          src="/brand/clinic-cali.jpg"
          alt="Consultorio del Centro Odontológico y Psicológico COP"
          class="hero-photo"
          width="1200"
          height="800"
          loading="eager"
          fetchpriority="high" />
        <div class="hero-visual-overlay" aria-hidden="true"></div>
      </div>

      <div class="container hero-layout">
        <div class="row align-items-end g-4 g-lg-5">
          <div class="col-lg-7">
            <div class="hero-copy-panel">
              <span class="hero-chip">Centro COP · Colombia</span>
              <h1 class="hero-title">Cuidado odontológico y psicológico con la calidez que mereces.</h1>
              <p class="hero-lead">
                Reserva en línea, elige tu sede por departamento y recibe confirmación clara de tu cita.
                Atención presencial con equipos especializados en salud oral y bienestar emocional.
              </p>

              <div class="d-flex flex-wrap gap-3 mt-4 hero-ctas">
                <a href="#booking" class="btn btn-primary btn-lg px-4">Reservar cita</a>
                <a href="#services" class="btn btn-outline-light btn-lg px-4">Ver servicios</a>
                <a routerLink="/register" class="btn btn-link btn-lg hero-register-link px-2">Crear cuenta</a>
              </div>

              <div class="hero-metrics" role="list">
                <div class="metric-card" role="listitem">
                  <strong>36+</strong>
                  <span>Sedes en Colombia</span>
                </div>
                <div class="metric-card" role="listitem">
                  <strong>2</strong>
                  <span>Especialidades</span>
                </div>
                <div class="metric-card" role="listitem">
                  <strong>24/7</strong>
                  <span>Reserva online</span>
                </div>
              </div>
            </div>
          </div>

          <div class="col-lg-5">
            <aside class="hero-service-card cop-card" aria-label="Servicio seleccionado">
              <p class="hero-service-label">Tu próxima cita</p>
              <h2 class="hero-service-title">{{ selectedServiceTitle || 'Explora nuestros servicios' }}</h2>
              <p class="hero-service-price">
                @if (selectedPrice > 0) {
                  Desde {{ selectedPrice | currency: 'COP':'symbol':'1.0-0' }}
                } @else {
                  Precios transparentes en catálogo
                }
              </p>
              <ul class="hero-service-meta">
                <li>
                  <span>Modalidad</span>
                  <strong>Presencial</strong>
                </li>
                <li>
                  <span>Duración</span>
                  <strong>{{ selectedDurationMinutes || '—' }}@if (selectedDurationMinutes) { min}</strong>
                </li>
                <li>
                  <span>Catálogo</span>
                  <strong>{{ serviceCount }} servicios</strong>
                </li>
              </ul>
              <a href="#booking" class="btn btn-primary w-100 mt-3">Continuar reserva</a>
            </aside>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .hero-section {
      position: relative;
      overflow: hidden;
      min-height: min(88vh, 720px);
      display: flex;
      align-items: flex-end;
    }

    .hero-visual {
      position: absolute;
      inset: 0;
      z-index: 0;
    }

    .hero-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 30%;
    }

    .hero-visual-overlay {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(105deg, rgba(15, 28, 30, 0.88) 0%, rgba(15, 28, 30, 0.55) 42%, rgba(15, 28, 30, 0.25) 100%),
        linear-gradient(0deg, rgba(15, 28, 30, 0.4) 0%, transparent 40%);
    }

    .hero-layout {
      position: relative;
      z-index: 1;
      padding-block: clamp(2.5rem, 6vw, 4rem);
    }

    .hero-copy-panel {
      color: #fff;
      max-width: 36rem;
    }

    .hero-chip {
      display: inline-flex;
      align-items: center;
      border-radius: var(--cop-radius-pill, 999px);
      padding: 0.35rem 0.85rem;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.14);
      border: 1px solid rgba(255, 255, 255, 0.22);
      backdrop-filter: blur(8px);
    }

    .hero-title {
      font-size: clamp(2rem, 4.5vw, 3.25rem);
      line-height: 1.08;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin: 1rem 0 0.75rem;
    }

    .hero-lead {
      font-size: 1.05rem;
      line-height: 1.65;
      color: rgba(255, 255, 255, 0.88);
      margin: 0;
    }

    .hero-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
      margin-top: 1.75rem;
    }

    .metric-card {
      border-radius: var(--cop-radius-md, 1.25rem);
      padding: 0.85rem 1rem;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.16);
      backdrop-filter: blur(10px);
      display: grid;
      gap: 0.15rem;
    }

    .metric-card strong {
      font-size: 1.35rem;
      font-weight: 700;
    }

    .metric-card span {
      font-size: 0.82rem;
      color: rgba(255, 255, 255, 0.78);
    }

    .hero-service-card {
      padding: 1.5rem;
      background: rgba(255, 255, 255, 0.97);
      backdrop-filter: blur(12px);
    }

    .hero-service-label {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--cop-brand, #0d6e6a);
      margin: 0 0 0.35rem;
    }

    .hero-service-title {
      font-size: 1.35rem;
      font-weight: 700;
      line-height: 1.25;
      color: var(--cop-ink, #0f1c1e);
      margin: 0 0 0.5rem;
    }

    .hero-service-price {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--cop-brand-dark, #0a5855);
      margin: 0 0 1rem;
    }

    .hero-service-meta {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 0.65rem;
    }

    .hero-service-meta li {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      font-size: 0.92rem;
      padding-bottom: 0.65rem;
      border-bottom: 1px solid var(--cop-border, rgba(15, 28, 30, 0.08));
    }

    .hero-service-meta li:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .hero-service-meta span {
      color: var(--cop-ink-muted, #5c6b6e);
    }

    .hero-register-link {
      color: rgba(255, 255, 255, 0.9) !important;
      font-weight: 600;
    }

    .hero-register-link:hover {
      color: #fff !important;
    }

    @media (max-width: 991px) {
      .hero-section {
        min-height: auto;
      }

      .hero-metrics {
        grid-template-columns: 1fr;
      }

      .hero-copy-panel {
        max-width: none;
      }
    }
  `,
})
export class PublicHeroSectionComponent {
  @Input() selectedServiceTitle = '';
  @Input() selectedPrice = 0;
  @Input() selectedDurationMinutes = 0;
  @Input() serviceCount = 0;
}
