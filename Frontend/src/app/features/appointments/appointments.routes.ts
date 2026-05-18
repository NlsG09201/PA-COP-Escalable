import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FullCalendarModule } from '@fullcalendar/angular';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import esLocale from '@fullcalendar/core/locales/es';
import { Routes } from '@angular/router';
import {
  AppointmentStatusVm,
  AppointmentVm,
  AppointmentsApiService,
  ProfessionalOptionVm,
} from './data-access/appointments-api.service';
import { extractHttpErrorMessage } from '../../core/http/extract-http-error-message';

const STATUS_LABELS: Record<AppointmentStatusVm, string> = {
  REQUESTED: 'Solicitada',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
};

function eventColors(item: AppointmentVm): { backgroundColor: string; borderColor: string; textColor: string } {
  if (!item.professionalId) {
    return { backgroundColor: '#f59e0b', borderColor: '#d97706', textColor: '#1e293b' };
  }
  switch (item.status) {
    case 'CONFIRMED':
      return { backgroundColor: '#0d6e6a', borderColor: '#0a5855', textColor: '#fff' };
    case 'COMPLETED':
      return { backgroundColor: '#059669', borderColor: '#047857', textColor: '#fff' };
    case 'CANCELLED':
      return { backgroundColor: '#94a3b8', borderColor: '#64748b', textColor: '#fff' };
    default:
      return { backgroundColor: '#6366f1', borderColor: '#4f46e5', textColor: '#fff' };
  }
}

@Component({
  standalone: true,
  imports: [FullCalendarModule, FormsModule],
  template: `
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
          <div>
            <h5 class="card-title mb-0">Gestión de Citas</h5>
            <p class="text-muted small mb-0">Ventana: últimos 7 días y próximos 30 · colores por estado</p>
          </div>
          <div class="d-flex align-items-center gap-2 flex-wrap" role="group" aria-label="Filtros de citas">
            <label class="form-label mb-0" for="status-filter">Estado</label>
            <select
              id="status-filter"
              class="form-select form-select-sm"
              style="width: 150px;"
              [(ngModel)]="statusFilter"
              (change)="reloadFromFirstPage()"
              [disabled]="loading()">
              <option [ngValue]="''">Todos</option>
              <option [ngValue]="'REQUESTED'">Solicitada</option>
              <option [ngValue]="'CONFIRMED'">Confirmada</option>
              <option [ngValue]="'CANCELLED'">Cancelada</option>
              <option [ngValue]="'COMPLETED'">Completada</option>
            </select>
            <div class="form-check m-0">
              <input
                class="form-check-input"
                type="checkbox"
                id="unassigned"
                [(ngModel)]="unassignedOnly"
                (change)="onUnassignedToggle()"
                [disabled]="loading()" />
              <label class="form-check-label" for="unassigned">Solo sin médico</label>
            </div>
            <label class="form-label mb-0" for="prof-filter">Profesional</label>
            <select
              id="prof-filter"
              class="form-select form-select-sm"
              style="width: 200px;"
              [(ngModel)]="professionalIdFilter"
              (change)="reloadFromFirstPage()"
              [disabled]="loading() || unassignedOnly">
              <option value="">Todos</option>
              @for (p of professionals(); track p.id) {
                <option [value]="p.id">{{ p.name }}</option>
              }
            </select>
            <label class="form-label mb-0" for="page-size">Tamaño</label>
            <select
              id="page-size"
              class="form-select form-select-sm"
              style="width: 92px;"
              [(ngModel)]="size"
              (change)="reloadFromFirstPage()"
              [disabled]="loading()">
              <option [ngValue]="25">25</option>
              <option [ngValue]="50">50</option>
              <option [ngValue]="100">100</option>
            </select>
            <button type="button" class="btn btn-outline-secondary btn-sm" (click)="prevPage()" [disabled]="page() <= 0 || loading()">
              Anterior
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm" (click)="nextPage()" [disabled]="!hasNext() || loading()">
              Siguiente
            </button>
          </div>
        </div>

        <div class="d-flex flex-wrap gap-2 small mb-2" aria-hidden="true">
          <span class="badge rounded-pill" style="background:#f59e0b;color:#1e293b">Sin médico</span>
          <span class="badge rounded-pill" style="background:#6366f1">Solicitada</span>
          <span class="badge rounded-pill" style="background:#0d6e6a">Confirmada</span>
          <span class="badge rounded-pill" style="background:#059669">Completada</span>
          <span class="badge rounded-pill" style="background:#94a3b8">Cancelada</span>
        </div>

        @if (loadError()) {
          <div class="alert alert-danger py-2 d-flex flex-wrap align-items-center gap-2" role="alert">
            <span>{{ loadError() }}</span>
            <button type="button" class="btn btn-sm btn-outline-danger" (click)="loadPage()">Reintentar</button>
          </div>
        }

        <p class="text-muted small mb-3" aria-live="polite">
          Página {{ page() + 1 }} · {{ loadedCount() }} citas en calendario · {{ total() }} en total
          @if (loading()) {
            <span class="spinner-border spinner-border-sm ms-1 align-middle"></span>
          }
        </p>

        <div class="calendar-shell position-relative" [attr.aria-busy]="loading()">
          <full-calendar [options]="calendarOptions()"></full-calendar>
          @if (loading()) {
            <div
              class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
              style="background: rgba(255,255,255,0.55); z-index: 5; border-radius: 1rem;">
              <div class="spinner-border text-primary" role="status" aria-label="Cargando citas"></div>
            </div>
          }
        </div>

        @if (selectedAppointmentId()) {
          <div class="card border-primary mt-3">
            <div class="card-body">
              <h6 class="card-title">Asignar cita seleccionada</h6>
              <p class="small text-muted mb-2">ID: {{ selectedAppointmentId() }}</p>
              <div class="row g-2 align-items-end">
                <div class="col-md-6">
                  <label class="form-label" for="claim-prof">Profesional</label>
                  <select id="claim-prof" class="form-select" [(ngModel)]="selectedProfessionalId">
                    <option value="">Elija…</option>
                    @for (p of professionals(); track p.id) {
                      <option [ngValue]="p.id">{{ p.name }}</option>
                    }
                  </select>
                </div>
                <div class="col-md-6 d-flex gap-2 flex-wrap">
                  <button
                    class="btn btn-primary"
                    type="button"
                    [disabled]="!selectedProfessionalId || claiming()"
                    (click)="claim()">
                    {{ claiming() ? 'Guardando…' : 'Tomar cita' }}
                  </button>
                  <button class="btn btn-outline-secondary" type="button" [disabled]="claiming()" (click)="clearSelection()">
                    Cancelar
                  </button>
                </div>
              </div>
              @if (claimError()) {
                <p class="text-danger small mb-0 mt-2" role="alert">{{ claimError() }}</p>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .calendar-shell {
      --fc-border-color: #e2e8f0;
      --fc-button-bg-color: #1d4ed8;
      --fc-button-border-color: #1d4ed8;
      --fc-button-hover-bg-color: #1e40af;
      --fc-button-hover-border-color: #1e40af;
      --fc-today-bg-color: rgba(37, 99, 235, 0.08);
      border-radius: 1rem;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      padding: 0.5rem;
      background: #fff;
    }
    :host ::ng-deep .fc .fc-toolbar-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--cop-ink, #0f1c1e);
    }
    :host ::ng-deep .fc-event {
      border-radius: 0.5rem;
      border-width: 2px;
      padding: 2px 4px;
      font-size: 0.78rem;
    }
  `,
})
class AppointmentsPageComponent {
  private readonly appointmentsApi = inject(AppointmentsApiService);

  protected readonly page = signal(0);
  protected size = 50;
  protected readonly total = signal(0);
  protected readonly loadedCount = signal(0);
  protected readonly hasNext = signal(false);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected statusFilter: AppointmentStatusVm | '' = '';
  protected professionalIdFilter = '';
  protected unassignedOnly = false;
  protected readonly professionals = signal<ProfessionalOptionVm[]>([]);
  protected readonly selectedAppointmentId = signal('');
  protected selectedProfessionalId = '';
  protected readonly claimError = signal('');
  protected readonly claiming = signal(false);

  protected readonly calendarOptions = signal<CalendarOptions>({
    plugins: [interactionPlugin, dayGridPlugin, timeGridPlugin],
    initialView: 'timeGridWeek',
    locale: esLocale,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    },
    height: 'auto',
    events: [],
    eventClick: (info) => {
      this.selectedAppointmentId.set(info.event.id);
      this.selectedProfessionalId = '';
      this.claimError.set('');
    },
  });

  constructor() {
    this.appointmentsApi.listProfessionals$().subscribe({
      next: (list) => this.professionals.set(list ?? []),
      error: () => this.professionals.set([]),
    });
    this.loadPage();
  }

  protected reloadFromFirstPage(): void {
    this.page.set(0);
    this.loadPage();
  }

  protected onUnassignedToggle(): void {
    if (this.unassignedOnly) {
      this.professionalIdFilter = '';
    }
    this.reloadFromFirstPage();
  }

  protected prevPage(): void {
    if (this.page() <= 0) return;
    this.page.update((p) => p - 1);
    this.loadPage();
  }

  protected nextPage(): void {
    if (!this.hasNext()) return;
    this.page.update((p) => p + 1);
    this.loadPage();
  }

  protected clearSelection(): void {
    this.selectedAppointmentId.set('');
    this.selectedProfessionalId = '';
    this.claimError.set('');
  }

  protected claim(): void {
    const appointmentId = this.selectedAppointmentId();
    if (!appointmentId || !this.selectedProfessionalId) return;
    this.claiming.set(true);
    this.claimError.set('');
    this.appointmentsApi.claimAppointment$(appointmentId, this.selectedProfessionalId).subscribe({
      next: () => {
        this.claiming.set(false);
        this.clearSelection();
        this.loadPage();
      },
      error: (err) => {
        this.claiming.set(false);
        this.claimError.set(extractHttpErrorMessage(err, 'No se pudo asignar la cita.'));
      },
    });
  }

  protected loadPage(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.appointmentsApi
      .listPage$(this.page(), this.size, {
        professionalId: this.unassignedOnly ? undefined : this.professionalIdFilter,
        status: this.statusFilter,
        unassignedOnly: this.unassignedOnly,
      })
      .subscribe({
        next: (result) => {
          this.page.set(Math.max(0, result.page));
          this.size = Math.max(1, result.size);
          this.total.set(Math.max(0, result.total));
          this.loadedCount.set(result.items.length);
          this.hasNext.set(result.hasNext);
          const events: EventInput[] = result.items.map((item) => {
            const colors = eventColors(item);
            const statusLabel = STATUS_LABELS[item.status as AppointmentStatusVm] ?? item.status;
            const prefix = !item.professionalId ? '[Sin médico] ' : '';
            return {
              id: item.id,
              title: `${prefix}${item.title} · ${statusLabel}`,
              start: item.start,
              end: item.end,
              ...colors,
            };
          });
          this.calendarOptions.update((opts) => ({ ...opts, events }));
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.loadError.set(extractHttpErrorMessage(err, 'No se pudieron cargar las citas.'));
          this.calendarOptions.update((opts) => ({ ...opts, events: [] }));
        },
      });
  }
}

export const APPOINTMENTS_ROUTES: Routes = [{ path: '', component: AppointmentsPageComponent }];
