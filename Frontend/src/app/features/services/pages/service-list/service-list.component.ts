import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ServiceCardComponent } from '../../components/service-card/service-card.component';
import { ServiceFilterComponent } from '../../components/service-filter/service-filter.component';
import { ServiceSearchComponent } from '../../components/service-search/service-search.component';
import { ServiceCategory } from '../../models/service.model';
import { ServicesStore } from '../../store/services.store';

@Component({
  selector: 'app-service-list-page',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, ReactiveFormsModule, ServiceCardComponent, ServiceFilterComponent, ServiceSearchComponent],
  providers: [ServicesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="services-page" data-testid="services-page">
      <div class="page-head mb-3">
        <h2 class="mb-1">Catalogo de Servicios Clinicos</h2>
        <p class="text-muted mb-0">Gestion dinamica para odontologia y psicologia con integracion al flujo de citas.</p>
      </div>

      <div class="toolbar card p-3 mb-3">
        <div class="row g-3">
          <div class="col-lg-6">
            <app-service-search [term]="store.query().search" (termChange)="store.setSearch($event)" />
          </div>
          <div class="col-lg-6 d-flex justify-content-lg-end">
            <app-service-filter
              [category]="store.query().category"
              [sort]="store.query().sort"
              (categoryChange)="store.setCategory($event)"
              (sortChange)="store.setSort($event)" />
          </div>
        </div>
      </div>

      <div class="card p-3 mb-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h3 class="h6 mb-0">Gestion de servicios (CRUD)</h3>
          <button class="btn btn-sm btn-outline-secondary" type="button" (click)="resetForm()">Nuevo</button>
        </div>
        <form [formGroup]="form" class="row g-2" (ngSubmit)="saveService()">
          <div class="col-md-4">
            <input class="form-control" placeholder="Nombre del servicio" formControlName="name" />
          </div>
          <div class="col-md-4">
            <input class="form-control" placeholder="Descripcion (opcional)" formControlName="description" />
          </div>
          <div class="col-md-2">
            <select class="form-select" formControlName="category">
              <option value="ODONTOLOGIA">Odontologia</option>
              <option value="PSICOLOGIA">Psicologia</option>
            </select>
          </div>
          <div class="col-md-1">
            <input class="form-control" type="number" min="0" placeholder="Precio" formControlName="price" />
          </div>
          <div class="col-md-1">
            <input class="form-control" type="number" min="1" placeholder="Min" formControlName="duration" />
          </div>
          <div class="col-12 d-flex flex-wrap gap-2">
            <button class="btn btn-primary btn-sm" type="submit" [disabled]="form.invalid">
              {{ editingServiceId() ? 'Actualizar' : 'Crear' }}
            </button>
            @if (editingServiceId(); as editingId) {
              <button
                class="btn btn-outline-warning btn-sm"
                type="button"
                (click)="toggleActive(editingId, !(store.selectedService()?.active ?? true))">
                {{ (store.selectedService()?.active ?? true) ? 'Desactivar' : 'Activar' }}
              </button>
              <button class="btn btn-outline-danger btn-sm" type="button" (click)="removeService(editingId)">
                Eliminar
              </button>
            }
          </div>
        </form>
        @if (store.operationMessage()) {
          <div class="alert alert-success py-2 mt-2 mb-0">{{ store.operationMessage() }}</div>
        }
      </div>

      @if (store.status() === 'loading') {
        <div class="state-card">Cargando catalogo de servicios...</div>
      } @else if (store.status() === 'error') {
        <div class="state-card state-card-error">
          {{ store.error() }}
          <button class="btn btn-sm btn-outline-danger ms-2" type="button" (click)="store.load(true)">Reintentar</button>
        </div>
      } @else if (store.filteredServices().length === 0) {
        <div class="state-card">No hay servicios para los filtros seleccionados.</div>
      } @else {
        @for (category of categories(); track category.key) {
          @if (category.items.length > 0) {
            <div class="category-block">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h3 class="h6 mb-0">{{ category.label }}</h3>
                <span class="text-muted small">{{ category.items.length }} servicios</span>
              </div>
              <div class="row g-3">
                @for (service of category.items; track service.id) {
                  <div class="col-md-6 col-xl-4">
                    <app-service-card
                      [service]="service"
                      [selected]="store.selectedService()?.id === service.id"
                      (select)="onSelectService($event)" />
                  </div>
                }
              </div>
            </div>
          }
        }
      }

      <div class="booking-panel card p-3 mt-4" data-testid="service-booking-selector">
        <h3 class="h6 mb-3">Selector dinamico para agendamiento</h3>
        <div class="row g-3 align-items-end">
          <div class="col-lg-6">
            <label class="form-label">Servicio seleccionado</label>
            <select
              class="form-select"
              [value]="store.selectedService()?.id ?? ''"
              (change)="store.selectService($any($event.target).value)">
              @for (service of store.filteredServices(); track service.id) {
                <option [value]="service.id">
                  {{ service.name }} - {{ service.price | currency: 'COP':'symbol':'1.0-0' }}
                </option>
              }
            </select>
          </div>
          <div class="col-lg-6">
            @if (store.selectedService(); as selected) {
              <div class="booking-summary">
                <div><span>Precio:</span> <strong>{{ selected.price | currency: 'COP':'symbol':'1.0-0' }}</strong></div>
                <div><span>Duracion:</span> <strong>{{ selected.duration ?? 45 }} min</strong></div>
                <div><span>Categoria:</span> <strong>{{ selected.category }}</strong></div>
              </div>
            }
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .services-page {
      max-width: 1280px;
      margin: 0 auto;
    }
    .page-head h2 {
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .toolbar,
    .booking-panel {
      border-radius: 14px;
      border: 1px solid #e5e7eb;
      background: #fff;
    }
    .state-card {
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      background: #f8fafc;
      padding: 1rem;
    }
    .state-card-error {
      border-color: #fecaca;
      background: #fef2f2;
      color: #991b1b;
    }
    .category-block {
      margin-top: 1rem;
    }
    .booking-summary {
      border-radius: 12px;
      border: 1px dashed #cbd5e1;
      background: #f8fafc;
      padding: 0.75rem 1rem;
      display: grid;
      gap: 0.25rem;
    }
    .booking-summary span {
      color: #64748b;
      margin-right: 0.4rem;
    }
  `
})
export class ServiceListComponent {
  protected readonly store = inject(ServicesStore);
  private readonly fb = inject(FormBuilder);
  protected readonly editingServiceId = computed(() => this.store.selectedService()?.id ?? null);
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    category: ['ODONTOLOGIA', [Validators.required]],
    price: [0, [Validators.required, Validators.min(0)]],
    duration: [45]
  });
  protected readonly categories = computed(() => [
    {
      key: 'ODONTOLOGIA',
      label: 'Odontologia',
      items: this.store.groupedByCategory().get('ODONTOLOGIA') ?? []
    },
    {
      key: 'PSICOLOGIA',
      label: 'Psicologia',
      items: this.store.groupedByCategory().get('PSICOLOGIA') ?? []
    }
  ]);

  constructor() {
    this.store.load();
  }

  protected onSelectService(serviceId: string): void {
    this.store.selectService(serviceId);
    const selected = this.store.services().find((service) => service.id === serviceId);
    if (!selected) {
      return;
    }
    this.form.patchValue({
      name: selected.name,
      description: selected.description,
      category: selected.category,
      price: selected.price,
      duration: selected.duration ?? 45
    });
  }

  protected saveService(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name,
      description: raw.description,
      category: (raw.category === 'PSICOLOGIA' ? 'PSICOLOGIA' : 'ODONTOLOGIA') as ServiceCategory,
      price: Number(raw.price),
      duration: raw.duration ? Number(raw.duration) : null
    };
    const editingId = this.editingServiceId();
    if (editingId) {
      this.store.updateService(editingId, payload);
      return;
    }
    this.store.createService(payload);
    this.resetForm();
  }

  protected toggleActive(id: string, nextActive: boolean): void {
    this.store.setServiceActive(id, nextActive);
  }

  protected removeService(id: string): void {
    this.store.deleteService(id);
    this.resetForm();
  }

  protected resetForm(): void {
    this.store.selectService('');
    this.form.reset({
      name: '',
      description: '',
      category: 'ODONTOLOGIA',
      price: 0,
      duration: 45
    });
  }
}
