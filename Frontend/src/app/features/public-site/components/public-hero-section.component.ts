import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-public-hero-section',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="hero" class="hero-section">
      <div class="container py-5">
        <div class="row align-items-center g-5">
          <div class="col-lg-6">
            <span class="hero-chip">Landing page sobre CoreUI + Bootstrap</span>
            <h1 class="hero-title mt-3">Atencion odontologica y psicologica con una experiencia digital clara y profesional.</h1>
            <p class="hero-copy">
              Agenda tu cita, revisa servicios y conoce precios transparentes desde una interfaz moderna,
              responsiva y conectada con reservas, checkout y confirmacion real.
            </p>

            <div class="d-flex flex-wrap gap-3 mt-4">
              <a href="#booking" class="btn btn-primary btn-lg px-4">Reservar cita</a>
              <a href="#pricing" class="btn btn-light btn-lg px-4">Ver precios</a>
            </div>

            <div class="hero-metrics mt-4">
              <div class="metric-card">
                <strong>{{ serviceCount }}</strong>
                <span>Servicios principales</span>
              </div>
              <div class="metric-card">
                <strong>2</strong>
                <span>Especialidades integradas</span>
              </div>
              <div class="metric-card">
                <strong>24/7</strong>
                <span>Reserva online</span>
              </div>
            </div>
          </div>

          <div class="col-lg-6">
            <div class="hero-panel shadow-lg">
              <div class="hero-panel-copy">
                <span class="hero-panel-tag">Experiencia premium</span>
                <h2>Flujo optimizado: servicio, precio, agenda y pago en una sola experiencia.</h2>
                <p>La web publica prioriza conversion, claridad de informacion y continuidad hacia el dashboard privado.</p>
              </div>

              <div class="preview-card">
                <div class="preview-head">
                  <span></span><span></span><span></span>
                </div>
                <div class="preview-body">
                  <div class="preview-highlight">
                    <strong>{{ selectedServiceTitle || 'Selecciona un servicio' }}</strong>
                    <span>{{ selectedPrice | currency: 'COP':'symbol':'1.0-0' }}</span>
                  </div>
                  <div class="preview-list">
                    <div>
                      <small>Modalidad</small>
                      <strong>Presencial</strong>
                    </div>
                    <div>
                      <small>Duracion</small>
                      <strong>{{ selectedDurationMinutes }} min</strong>
                    </div>
                    <div>
                      <small>Estado</small>
                      <strong>Reserva y checkout listos</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .hero-section {
      padding: 2rem 0 3rem;
    }

    .hero-chip,
    .hero-panel-tag {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0.35rem 0.75rem;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .hero-chip {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .hero-panel-tag {
      background: rgba(255, 255, 255, 0.14);
      color: #dbeafe;
    }

    .hero-title {
      font-size: clamp(2.3rem, 5vw, 4.4rem);
      line-height: 1.05;
      font-weight: 800;
      letter-spacing: -0.04em;
    }

    .hero-copy {
      font-size: 1.05rem;
      color: #475569;
      max-width: 40rem;
    }

    .hero-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
    }

    .metric-card {
      border-radius: 1.25rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.16);
      display: grid;
      gap: 0.25rem;
    }

    .metric-card strong {
      font-size: 1.5rem;
    }

    .metric-card span {
      color: #64748b;
      font-size: 0.9rem;
    }

    .hero-panel {
      border-radius: 2rem;
      padding: 2rem;
      color: #fff;
      background: linear-gradient(145deg, #0f172a 0%, #1d4ed8 52%, #7c3aed 100%);
    }

    .hero-panel h2 {
      font-size: 1.8rem;
      line-height: 1.15;
      margin: 0.75rem 0;
    }

    .hero-panel p {
      color: rgba(255, 255, 255, 0.82);
    }

    .preview-card {
      margin-top: 1.75rem;
      border-radius: 1.4rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.16);
    }

    .preview-head {
      display: flex;
      gap: 0.45rem;
      margin-bottom: 1rem;
    }

    .preview-head span {
      width: 0.7rem;
      height: 0.7rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.45);
    }

    .preview-highlight {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      border-radius: 1rem;
      padding: 1rem;
      background: #fff;
      color: #0f172a;
    }

    .preview-list {
      display: grid;
      gap: 0.85rem;
      margin-top: 1rem;
    }

    .preview-list small {
      display: block;
      color: rgba(255, 255, 255, 0.72);
    }

    @media (max-width: 991px) {
      .hero-metrics {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class PublicHeroSectionComponent {
  @Input() selectedServiceTitle = '';
  @Input() selectedPrice = 0;
  @Input() selectedDurationMinutes = 0;
  @Input() serviceCount = 0;
}
