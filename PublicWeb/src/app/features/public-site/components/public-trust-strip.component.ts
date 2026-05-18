import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-public-trust-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="trust-strip" aria-label="Ventajas del servicio">
      <div class="container">
        <ul class="trust-list">
          <li class="trust-item">
            <span class="trust-icon" aria-hidden="true">◆</span>
            <span><strong>36+ sedes</strong> en Colombia</span>
          </li>
          <li class="trust-item">
            <span class="trust-icon" aria-hidden="true">◆</span>
            <span><strong>Confirmación</strong> por correo</span>
          </li>
          <li class="trust-item">
            <span class="trust-icon" aria-hidden="true">◆</span>
            <span><strong>Reserva 24/7</strong> en línea</span>
          </li>
          <li class="trust-item">
            <span class="trust-icon" aria-hidden="true">◆</span>
            <span><strong>Equipo clínico</strong> especializado</span>
          </li>
        </ul>
      </div>
    </section>
  `,
  styles: `
    .trust-strip {
      padding-block: 1.25rem;
      background: var(--cop-brand-light);
      border-block: 1px solid rgba(13, 110, 106, 0.12);
    }

    .trust-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.85rem 1.25rem;
    }

    @media (min-width: 768px) {
      .trust-list {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }

    .trust-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      color: var(--cop-ink-muted);
    }

    .trust-item strong {
      color: var(--cop-brand-dark);
      font-weight: 700;
    }

    .trust-icon {
      color: var(--cop-brand);
      font-size: 0.55rem;
      line-height: 1;
    }
  `,
})
export class PublicTrustStripComponent {}
