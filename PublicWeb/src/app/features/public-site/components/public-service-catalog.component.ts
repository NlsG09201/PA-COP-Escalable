import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { PublicServiceVm } from '../data-access/public-booking.service';

@Component({
  selector: 'app-public-service-catalog',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="services" class="cop-section-block">
      <div class="container">
        <header class="cop-section-head">
          <span class="cop-section-eyebrow">Servicios</span>
          <h2 class="cop-section-title">Catálogo por especialidad</h2>
          <p class="cop-section-copy">Información clara, beneficios visibles y precios transparentes para planificar tu cita.</p>
        </header>

        @for (group of groupedServices(); track group.category) {
          <div class="category-block">
            <h3 class="category-title">{{ group.category }}</h3>
            <div class="row g-4">
              @for (service of group.items; track service.id) {
                <div class="col-md-6 col-xl-4">
                  <article class="service-card cop-card-hover h-100" [class.service-card-active]="service.id === selectedServiceId">
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

                    <p class="duration-line">Duración estimada: {{ service.durationMinutes }} min</p>

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
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--cop-ink-muted, #5c6b6e);
      margin: 0 0 1rem;
      font-weight: 700;
    }

    .service-card {
      height: 100%;
      border-radius: var(--cop-radius-lg, 1.75rem);
      padding: 1.5rem;
      background: var(--cop-surface-elevated, #fff);
      border: 1px solid var(--cop-border, rgba(15, 28, 30, 0.08));
      box-shadow: var(--cop-shadow-sm);
      display: flex;
      flex-direction: column;
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    }

    .service-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--cop-shadow-md);
    }

    .service-card-active {
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
      color: var(--cop-ink-subtle, #8a9799);
      text-decoration: line-through;
    }

    .duration-line {
      margin: 0 0 1rem;
      color: var(--cop-ink-muted, #5c6b6e);
      font-size: 0.92rem;
    }

    .service-features {
      list-style: none;
      padding: 0;
      margin: 0 0 1.5rem;
      display: grid;
      gap: 0.65rem;
      color: var(--cop-ink-muted, #5c6b6e);
    }

    .service-features li::before {
      content: "•";
      color: var(--cop-brand, #0d6e6a);
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
