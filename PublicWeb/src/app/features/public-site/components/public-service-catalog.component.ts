import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { PublicServiceVm } from '../data-access/public-booking.service';

@Component({
  selector: 'app-public-service-catalog',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="services" class="section-block">
      <div class="container">
        <div class="section-head">
          <span class="section-eyebrow">Servicios</span>
          <h2>Catalogo publico por especialidad</h2>
          <p>Informacion clara, beneficios visibles y precios preparados para promociones y pagos futuros.</p>
        </div>

        @for (group of groupedServices(); track group.category) {
          <div class="category-block">
            <h3 class="category-title">{{ group.category }}</h3>
            <div class="row g-4">
              @for (service of group.items; track service.id) {
                <div class="col-md-6 col-xl-4">
                  <article class="service-card h-100" [class.service-card-active]="service.id === selectedServiceId">
                    <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                      <div>
                        <span class="service-category">{{ service.category }}</span>
                        <h3 class="h5 mt-2 mb-1">{{ service.title }}</h3>
                      </div>
                      @if (service.badge) {
                        <span class="badge rounded-pill text-bg-light">{{ service.badge }}</span>
                      }
                    </div>

                    <p class="text-muted">{{ service.description }}</p>

                    <div class="price-line">
                      <strong>{{ service.priceToPay | currency: 'COP':'symbol':'1.0-0' }}</strong>
                      @if (service.promoPrice) {
                        <span>{{ service.basePrice | currency: 'COP':'symbol':'1.0-0' }}</span>
                      }
                    </div>

                    <p class="duration-line">Duracion estimada: {{ service.durationMinutes }} min</p>

                    <ul class="service-features">
                      @for (feature of service.features; track feature) {
                        <li>{{ feature }}</li>
                      }
                    </ul>

                    <button class="btn btn-outline-primary mt-auto" type="button" (click)="selectService.emit(service.id)">
                      Elegir este servicio
                    </button>
                  </article>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    .category-block {
      margin-bottom: 2rem;
    }

    .category-title {
      font-size: 1.05rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #334155;
      margin: 0 0 1rem;
      font-weight: 800;
    }

    .section-block {
      padding: 1.5rem 0 4rem;
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

    .service-card {
      height: 100%;
      border-radius: 1.6rem;
      padding: 1.5rem;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(148, 163, 184, 0.14);
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.06);
      display: flex;
      flex-direction: column;
    }

    .service-card-active {
      border-color: rgba(37, 99, 235, 0.3);
      transform: translateY(-2px);
    }

    .service-category {
      color: #2563eb;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .price-line {
      display: flex;
      align-items: baseline;
      gap: 0.7rem;
      margin: 0.75rem 0 1rem;
    }

    .price-line strong {
      font-size: 1.8rem;
    }

    .price-line span {
      color: #94a3b8;
      text-decoration: line-through;
    }

    .duration-line {
      margin: 0 0 1rem;
      color: #64748b;
      font-size: 0.92rem;
    }

    .service-features {
      list-style: none;
      padding: 0;
      margin: 0 0 1.5rem;
      display: grid;
      gap: 0.65rem;
      color: #334155;
    }

    .service-features li::before {
      content: "•";
      color: #7c3aed;
      margin-right: 0.5rem;
    }
  `
})
export class PublicServiceCatalogComponent {
  @Input() services: PublicServiceVm[] = [];
  @Input() selectedServiceId = '';
  @Output() readonly selectService = new EventEmitter<string>();

  protected groupedServices(): Array<{ category: string; items: PublicServiceVm[] }> {
    const groups = new Map<string, PublicServiceVm[]>();
    for (const service of this.services) {
      const key = (service.category || 'General').trim();
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(service);
    }
    return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
  }
}
