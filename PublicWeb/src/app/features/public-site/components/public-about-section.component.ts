import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-public-about-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="about" class="cop-section-block about-section">
      <div class="container">
        <div class="row g-4 g-lg-5 align-items-center">
          <div class="col-lg-6">
            <span class="cop-section-eyebrow">Nosotros</span>
            <h2 class="cop-section-title text-lg-start">Cuidado integral con enfoque humano y seguimiento clínico.</h2>
            <p class="cop-section-copy text-lg-start">
              En Centro COP unimos odontología y psicología en un mismo ecosistema: reserva digital,
              historial clínico seguro y acompañamiento continuo entre la web pública y nuestro equipo profesional.
            </p>
            <ul class="about-list">
              <li>Red de sedes en departamentos de Colombia</li>
              <li>Reserva en línea con confirmación y recordatorios</li>
              <li>Profesionales con acceso al panel clínico autorizado</li>
            </ul>
          </div>
          <div class="col-lg-6">
            <div class="about-grid">
              <article class="about-tile cop-card">
                <strong>36+</strong>
                <span>Sedes activas en el país</span>
              </article>
              <article class="about-tile cop-card">
                <strong>2</strong>
                <span>Especialidades: odontología y psicología</span>
              </article>
              <article class="about-tile cop-card">
                <strong>100%</strong>
                <span>Reserva y seguimiento digital</span>
              </article>
              <article class="about-tile cop-card">
                <strong>24/7</strong>
                <span>Agenda disponible cuando la necesites</span>
              </article>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .about-section .cop-section-title,
    .about-section .cop-section-copy {
      text-align: left;
    }

    .about-list {
      margin: 1.25rem 0 0;
      padding-left: 1.2rem;
      color: var(--cop-ink-muted, #5c6b6e);
      display: grid;
      gap: 0.5rem;
    }

    .about-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .about-tile {
      padding: 1.25rem;
      display: grid;
      gap: 0.35rem;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .about-tile:hover {
      transform: translateY(-2px);
      box-shadow: var(--cop-shadow-md);
    }

    .about-tile strong {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--cop-brand, #0d6e6a);
      line-height: 1.1;
    }

    .about-tile span {
      font-size: 0.9rem;
      color: var(--cop-ink-muted, #5c6b6e);
    }

    @media (max-width: 575px) {
      .about-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class PublicAboutSectionComponent {}
