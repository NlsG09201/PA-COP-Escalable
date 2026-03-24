import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ServiceItem } from '../../models/service.model';

@Component({
  selector: 'app-service-card',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="service-card h-100" [class.service-card-selected]="selected">
      <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
        <div>
          <h3 class="h6 mb-1">{{ service.name }}</h3>
          <span class="category-badge" [class.category-badge-psych]="service.category === 'PSICOLOGIA'">
            {{ service.category === 'ODONTOLOGIA' ? 'Odontologia' : 'Psicologia' }}
          </span>
        </div>
        <strong class="price">{{ service.price | currency: 'COP':'symbol':'1.0-0' }}</strong>
      </div>

      @if (service.description) {
        <p class="text-muted small mb-3">{{ service.description }}</p>
      } @else {
        <p class="text-muted small mb-3">Sin descripcion adicional.</p>
      }

      <div class="meta-row mb-3">
        <span>Duracion</span>
        <strong>{{ service.duration ?? 45 }} min</strong>
      </div>

      <button type="button" class="btn btn-sm btn-outline-primary w-100" (click)="select.emit(service.id)">
        Seleccionar servicio
      </button>
    </article>
  `,
  styles: `
    .service-card {
      border-radius: 16px;
      border: 1px solid #e5e7eb;
      background: #ffffff;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
      padding: 1rem;
      display: flex;
      flex-direction: column;
    }
    .service-card-selected {
      border-color: #60a5fa;
      box-shadow: 0 8px 24px rgba(37, 99, 235, 0.14);
    }
    .price {
      color: #0f172a;
      font-size: 0.95rem;
      white-space: nowrap;
    }
    .category-badge {
      display: inline-flex;
      border-radius: 999px;
      padding: 0.2rem 0.55rem;
      font-size: 0.72rem;
      font-weight: 700;
      background: #dbeafe;
      color: #1d4ed8;
    }
    .category-badge-psych {
      background: #ede9fe;
      color: #6d28d9;
    }
    .meta-row {
      margin-top: auto;
      display: flex;
      justify-content: space-between;
      color: #475569;
      font-size: 0.85rem;
    }
  `
})
export class ServiceCardComponent {
  @Input({ required: true }) service!: ServiceItem;
  @Input() selected = false;
  @Output() readonly select = new EventEmitter<string>();
}
