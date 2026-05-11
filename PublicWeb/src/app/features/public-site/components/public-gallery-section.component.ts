import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-public-gallery-section',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="gallery" class="gallery-section py-5">
      <div class="container">
        <div class="mb-4">
          <span class="eyebrow">Nuestra sede</span>
          <h2 class="section-title mb-2">Imágenes y ambiente</h2>
          <p class="section-lead mb-0">Un vistazo a la atención en Cali y a los espacios preparados para odontología y psicología.</p>
        </div>

        <div class="row g-4">
          <div class="col-md-6 col-lg-4">
            <figure class="gallery-card mb-0">
              <img src="/brand/clinic-cali.jpg" alt="Atención odontológica en Cali" class="gallery-img w-100" loading="lazy" />
              <figcaption class="gallery-cap">Presencia física en Cali.</figcaption>
            </figure>
          </div>
          <div class="col-md-6 col-lg-4">
            <figure class="gallery-card mb-0">
              <img src="/brand/psicologia-servicio.jpg" alt="Servicio de psicología con protocolos" class="gallery-img w-100" loading="lazy" />
              <figcaption class="gallery-cap">Psicología con protocolos de bioseguridad.</figcaption>
            </figure>
          </div>
          <div class="col-md-12 col-lg-4">
            <figure class="gallery-card mb-0">
              <img src="/brand/plataforma-preview.png" alt="Vista de la plataforma digital" class="gallery-img w-100" loading="lazy" />
              <figcaption class="gallery-cap">Continuidad digital con reservas y seguimiento.</figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .gallery-section {
      border-top: 1px solid rgba(15, 23, 42, 0.06);
      background: #fff;
    }
    .eyebrow {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #2563eb;
      margin-bottom: 0.35rem;
    }
    .section-title {
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .section-lead {
      color: #64748b;
      max-width: 46rem;
    }
    .gallery-card {
      border-radius: 1.35rem;
      overflow: hidden;
      border: 1px solid rgba(148, 163, 184, 0.16);
      background: rgba(248, 250, 252, 0.9);
    }
    .gallery-img {
      display: block;
      aspect-ratio: 4 / 3;
      object-fit: cover;
    }
    .gallery-cap {
      padding: 0.75rem 1rem;
      font-size: 0.9rem;
      color: #475569;
      margin: 0;
    }
  `,
})
export class PublicGallerySectionComponent {}
