import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { PublicServiceVm } from '../data-access/public-booking.service';

@Component({
  selector: 'app-public-pricing-grid',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="pricing" class="section-block section-muted">
      <div class="container">
        <div class="section-head">
          <span class="section-eyebrow">Precios</span>
          <h2>Tarifas visibles y listas para promociones</h2>
          <p>La logica de precios distingue tarifa base, precio promocional y valor final cotizado.</p>
        </div>

        <div class="row g-4">
          @for (service of services; track service.id) {
            <div class="col-lg-4">
              <article class="pricing-card h-100" [class.pricing-card-featured]="service.id === selectedServiceId">
                <span class="service-category">{{ service.category }}</span>
                <h3 class="h5 mt-2">{{ service.title }}</h3>
                <p class="text-muted">{{ service.durationMinutes }} minutos de atencion estimada.</p>

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
    .section-block {
      padding: 1.5rem 0 4rem;
    }

    .section-muted {
      background: rgba(255, 255, 255, 0.66);
      border-top: 1px solid rgba(15, 23, 42, 0.04);
      border-bottom: 1px solid rgba(15, 23, 42, 0.04);
    }

    .section-head {
      max-width: 42rem;
      margin: 0 auto 2rem;
      text-align: center;
    }

    .section-head h2 {
      font-size: clamp(1.8rem, 4vw, 3rem);
      line-height: 1.1;
      margin: 0.85rem 0;
      font-weight: 800;
    }

    .section-head p {
      color: #64748b;
      font-size: 1rem;
    }

    .section-eyebrow {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0.35rem 0.75rem;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: #ede9fe;
      color: #6d28d9;
    }

    .pricing-card {
      height: 100%;
      border-radius: 1.6rem;
      padding: 1.5rem;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(148, 163, 184, 0.14);
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.06);
      display: flex;
      flex-direction: column;
    }

    .pricing-card-featured {
      border-color: rgba(37, 99, 235, 0.35);
      transform: translateY(-2px);
    }

    .service-category {
      color: #2563eb;
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
