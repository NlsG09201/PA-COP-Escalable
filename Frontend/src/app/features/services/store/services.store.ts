import { computed, Injectable, signal } from '@angular/core';
import { ServiceApiService } from '../services/service-api.service';
import { ServiceItem, ServiceQuery, UpsertServicePayload } from '../models/service.model';

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

const CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class ServicesStore {
  private readonly state = signal<{
    services: ServiceItem[];
    query: ServiceQuery;
    selectedServiceId: string | null;
    status: LoadingState;
    error: string;
    lastLoadedAt: number | null;
  }>({
    services: [],
    query: {
      category: 'ALL',
      search: '',
      sort: 'name_asc'
    },
    selectedServiceId: null,
    status: 'idle',
    error: '',
    lastLoadedAt: null
  });

  readonly services = computed(() => this.state().services);
  readonly query = computed(() => this.state().query);
  readonly status = computed(() => this.state().status);
  readonly error = computed(() => this.state().error);
  readonly operationMessage = signal('');
  readonly selectedService = computed(() =>
    this.state().services.find((service) => service.id === this.state().selectedServiceId) ?? null
  );
  readonly filteredServices = computed(() => {
    const { category, search, sort } = this.state().query;
    const q = search.trim().toLowerCase();
    const filtered = this.state().services.filter((service) => {
      if (category !== 'ALL' && service.category !== category) {
        return false;
      }
      if (!q) {
        return true;
      }
      return service.name.toLowerCase().includes(q) || service.description.toLowerCase().includes(q);
    });
    return filtered.sort((a, b) => {
      if (sort === 'price_asc') {
        return a.price - b.price;
      }
      if (sort === 'price_desc') {
        return b.price - a.price;
      }
      return a.name.localeCompare(b.name, 'es');
    });
  });

  readonly groupedByCategory = computed(() => {
    const groups = new Map<'ODONTOLOGIA' | 'PSICOLOGIA', ServiceItem[]>();
    groups.set('ODONTOLOGIA', []);
    groups.set('PSICOLOGIA', []);
    for (const service of this.filteredServices()) {
      groups.get(service.category)!.push(service);
    }
    return groups;
  });

  constructor(private readonly api: ServiceApiService) {}

  load(force = false): void {
    if (!force && this.isCacheFresh()) {
      return;
    }
    this.patch({ status: 'loading', error: '' });
    this.api.listServices$().subscribe({
      next: (services) => {
        this.patch({
          services,
          status: 'success',
          error: '',
          lastLoadedAt: Date.now(),
          selectedServiceId: this.state().selectedServiceId ?? services[0]?.id ?? null
        });
      },
      error: () => {
        this.patch({
          status: 'error',
          error: 'No fue posible cargar el catalogo de servicios. Intenta nuevamente.'
        });
      }
    });
  }

  setCategory(category: ServiceQuery['category']): void {
    this.patch({
      query: {
        ...this.state().query,
        category
      }
    });
  }

  setSearch(search: string): void {
    this.patch({
      query: {
        ...this.state().query,
        search: search.slice(0, 120)
      }
    });
  }

  setSort(sort: ServiceQuery['sort']): void {
    this.patch({
      query: {
        ...this.state().query,
        sort
      }
    });
  }

  selectService(serviceId: string): void {
    this.patch({ selectedServiceId: serviceId });
  }

  createService(payload: UpsertServicePayload): void {
    this.patch({ status: 'loading', error: '' });
    this.api.createService$(payload).subscribe({
      next: () => {
        this.operationMessage.set('Servicio creado correctamente.');
        this.load(true);
      },
      error: (err: { error?: { message?: string } }) => {
        this.patch({
          status: 'error',
          error: err?.error?.message ?? 'No fue posible crear el servicio.'
        });
      }
    });
  }

  updateService(id: string, payload: UpsertServicePayload): void {
    this.patch({ status: 'loading', error: '' });
    this.api.updateService$(id, payload).subscribe({
      next: () => {
        this.operationMessage.set('Servicio actualizado correctamente.');
        this.load(true);
      },
      error: (err: { error?: { message?: string } }) => {
        this.patch({
          status: 'error',
          error: err?.error?.message ?? 'No fue posible actualizar el servicio.'
        });
      }
    });
  }

  setServiceActive(id: string, active: boolean): void {
    this.patch({ status: 'loading', error: '' });
    this.api.setActive$(id, active).subscribe({
      next: () => {
        this.operationMessage.set(active ? 'Servicio activado.' : 'Servicio desactivado.');
        this.load(true);
      },
      error: (err: { error?: { message?: string } }) => {
        this.patch({
          status: 'error',
          error: err?.error?.message ?? 'No fue posible actualizar el estado del servicio.'
        });
      }
    });
  }

  deleteService(id: string): void {
    this.patch({ status: 'loading', error: '' });
    this.api.deleteService$(id).subscribe({
      next: () => {
        this.operationMessage.set('Servicio eliminado del catalogo.');
        this.load(true);
      },
      error: (err: { error?: { message?: string } }) => {
        this.patch({
          status: 'error',
          error: err?.error?.message ?? 'No fue posible eliminar el servicio.'
        });
      }
    });
  }

  private isCacheFresh(): boolean {
    const loadedAt = this.state().lastLoadedAt;
    return loadedAt != null && Date.now() - loadedAt < CACHE_TTL_MS && this.state().services.length > 0;
  }

  private patch(
    partial: Partial<{
      services: ServiceItem[];
      query: ServiceQuery;
      selectedServiceId: string | null;
      status: LoadingState;
      error: string;
      lastLoadedAt: number | null;
    }>
  ): void {
    this.state.update((current) => ({
      ...current,
      ...partial
    }));
  }
}
