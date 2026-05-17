import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-public-about-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="about" class="section-block about-section">
      <div class="container">
        <div class="row g-4 align-items-center">
          <div class="col-lg-6">
            <span class="section-eyebrow">Nosotros</span>
            <h2 class="section-title">Cuidado odontológico y psicológico con enfoque humano y datos clínicos.</h2>
            <p class="section-copy">
              Integramos agenda digital, historial clínico y modelos de riesgo (J48) para acompañar cada paciente
              con claridad, seguimiento y continuidad entre la web pública y el panel profesional.
            </p>
            <ul class="about-list">
              <li>Red de sedes en departamentos de Colombia</li>
              <li>Reserva online, pagos locales y confirmación inmediata</li>
              <li>Equipo clínico con acceso seguro al dashboard</li>
            </ul>
          </div>
          <div class="col-lg-6">
            <div class="about-grid">
              <article class="about-tile">
                <strong>15k+</strong>
                <span>Pacientes soportados en el dataset de entrenamiento</span>
              </article>
              <article class="about-tile">
                <strong>J48</strong>
                <span>Modelo de clasificación de riesgo integrado</span>
              </article>
              <article class="about-tile">
                <strong>32+</strong>
                <span>Departamentos con sedes registradas</span>
              </article>
              <article class="about-tile">
                <strong>24/7</strong>
                <span>Autogestión de citas para pacientes</span>
              </article>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .about-section {
      padding: 4rem 0;
    }

    .section-eyebrow {
      display: inline-block;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #1d4ed8;
      margin-bottom: 0.5rem;
    }

    .section-title {
      font-size: clamp(1.75rem, 3vw, 2.4rem);
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.15;
    }

    .section-copy {
      color: #475569;
      font-size: 1.05rem;
      max-width: 36rem;
    }

    .about-list {
      margin: 1.25rem 0 0;
      padding-left: 1.1rem;
      color: #334155;
      display: grid;
      gap: 0.5rem;
    }

    .about-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .about-tile {
      border-radius: 1.25rem;
      padding: 1.25rem;
      background: #fff;
      border: 1px solid rgba(148, 163, 184, 0.2);
      box-shadow: 0 12px 40px rgba(15, 23, 42, 0.06);
      display: grid;
      gap: 0.35rem;
    }

    .about-tile strong {
      font-size: 1.5rem;
      color: #0f172a;
    }

    .about-tile span {
      color: #64748b;
      font-size: 0.9rem;
    }
  `,
})
export class PublicAboutSectionComponent {}
