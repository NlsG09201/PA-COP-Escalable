import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { PublicServiceVm } from '../data-access/public-booking.service';

@Component({
  selector: 'app-public-pricing-grid',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="pricing" class="cop-section-block cop-section-muted">
      <div class="container">
        <header class="cop-section-head">
          <span class="cop-section-eyebrow">Precios</span>
          <h2 class="cop-section-title">Tarifas claras y transparentes</h2>
          <p class="cop-section-copy">Tarifa base, promociones vigentes y valor final antes de confirmar tu cita.</p>
        </header>

        <div class="row g-4">
          @for (service of services; track service.id) {
            <div class="col-lg-4">
              <article class="pricing-card h-100" [class.pricing-card-featured]="service.id === selectedServiceId">
                <span class="service-category">{{ service.category }}</span>
                <h3 class="h5 mt-2">{{ service.title }}</h3>
                <p class="text-muted">{{ service.durationMinutes }} minutos de atención estimada.</p>

                <div class="pricing-amount">
                  <strong>{{ service.priceToPay | currency: 'COP':'symbol':'1.0-0' }}</strong>
                  @if (service.promoPrice) {
                    <small>{{ service.basePrice | currency: 'COP':'symbol':'1.0-0' }}</small>
                  }
                </div>

                <button class="btn btn-primary mt-3" type="button" (click)="selectService.emit(service.id)">Cotizar y reservar</button>
              </article>
            </div>
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    .pricing-card {
      height: 100%;
      border-radius: var(--cop-radius-lg, 1.75rem);
      padding: 1.5rem;
      background: var(--cop-surface-elevated, #fff);
      border: 1px solid var(--cop-border);
      box-shadow: var(--cop-shadow-sm);
      display: flex;
      flex-direction: column;
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    }

    .pricing-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--cop-shadow-md);
    }

    .pricing-card-featured {
      border-color: rgba(13, 110, 106, 0.35);
      box-shadow: var(--cop-shadow-md);
    }

    .service-category {
      color: var(--cop-brand, #0d6e6a);
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .pricing-amount {
      display: flex;
      align-items: baseline;
      gap: 0.7rem;
      margin: 0.75rem 0 1rem;
    }

    .pricing-amount strong {
      font-size: 1.8rem;
    }

    .pricing-amount small {
      color: #94a3b8;
      text-decoration: line-through;
    }
  `
})
export class PublicPricingGridComponent {
  @Input() services: PublicServiceVm[] = [];
  @Input() selectedServiceId = '';
  @Output() readonly selectService = new EventEmitter<string>();
}
