import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-public-gallery-section',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="gallery" class="cop-section-block gallery-section">
      <div class="container">
        <header class="cop-section-head text-start mb-4">
          <span class="cop-section-eyebrow">Nuestra sede</span>
          <h2 class="cop-section-title text-start mb-2">Imágenes y ambiente</h2>
          <p class="cop-section-copy text-start mb-0">Un vistazo a la atención en Cali y espacios preparados para odontología y psicología.</p>
        </header>

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
      border-top: 1px solid var(--cop-border);
      background: var(--cop-surface-elevated, #fff);
    }
    .gallery-card {
      border-radius: var(--cop-radius-md, 1.25rem);
      overflow: hidden;
      border: 1px solid var(--cop-border);
      background: var(--cop-surface);
      box-shadow: var(--cop-shadow-sm);
    }
    .gallery-img {
      display: block;
      aspect-ratio: 4 / 3;
      object-fit: cover;
    }
    .gallery-cap {
      padding: 0.75rem 1rem;
      font-size: 0.9rem;
      color: var(--cop-ink-muted, #5c6b6e);
      margin: 0;
    }
  `,
})
export class PublicGallerySectionComponent {}
