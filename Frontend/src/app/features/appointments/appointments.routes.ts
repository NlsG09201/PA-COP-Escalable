import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FullCalendarModule } from '@fullcalendar/angular';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import { CalendarOptions } from '@fullcalendar/core';
import { Routes } from '@angular/router';
import { AppointmentsApiService, AppointmentStatusVm, ProfessionalOptionVm } from './data-access/appointments-api.service';
import { catchError, of } from 'rxjs';

@Component({
  standalone: true,
  imports: [FullCalendarModule, FormsModule],
  template: `
    <div class="card">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
          <h5 class="card-title mb-0">Gestion de Citas</h5>
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <label class="form-label mb-0">Estado</label>
            <select class="form-select form-select-sm" style="width: 140px;" [(ngModel)]="statusFilter" (change)="reloadFromFirstPage()">
              <option [ngValue]="''">Todos</option>
              <option [ngValue]="'REQUESTED'">Requested</option>
              <option [ngValue]="'CONFIRMED'">Confirmed</option>
              <option [ngValue]="'CANCELLED'">Cancelled</option>
              <option [ngValue]="'COMPLETED'">Completed</option>
            </select>
            <div class="form-check m-0">
              <input class="form-check-input" type="checkbox" id="unassigned" [(ngModel)]="unassignedOnly" (change)="reloadFromFirstPage()" />
              <label class="form-check-label" for="unassigned">Solo sin medico</label>
            </div>
            <label class="form-label mb-0">Profesional (filtro)</label>
            <input
              class="form-control form-control-sm"
              style="width: 220px;"
              placeholder="UUID (opcional)"
              [(ngModel)]="professionalIdFilter"
              (keyup.enter)="reloadFromFirstPage()"
            />
            <label class="form-label mb-0">Tamano</label>
            <select class="form-select form-select-sm" style="width: 92px;" [(ngModel)]="size" (change)="reloadFromFirstPage()">
              <option [ngValue]="25">25</option>
              <option [ngValue]="50">50</option>
              <option [ngValue]="100">100</option>
            </select>
            <button class="btn btn-outline-secondary btn-sm" (click)="prevPage()" [disabled]="page <= 0">Anterior</button>
            <button class="btn btn-outline-secondary btn-sm" (click)="nextPage()" [disabled]="!hasNext">Siguiente</button>
          </div>
        </div>
        <div class="text-muted small mb-3">
          Mostrando pagina {{ page + 1 }} - {{ loadedCount }} registros cargados de {{ total }}.
        </div>
        <div class="calendar-shell">
          <full-calendar [options]="calendarOptions"></full-calendar>
        </div>

        @if (selectedAppointmentId) {
          <div class="card border-primary mt-3">
            <div class="card-body">
              <h6 class="card-title">Asignar cita seleccionada</h6>
              <p class="small text-muted mb-2">ID: {{ selectedAppointmentId }}</p>
              <div class="row g-2 align-items-end">
                <div class="col-md-6">
                  <label class="form-label">Profesional</label>
                  <select class="form-select" [(ngModel)]="selectedProfessionalId">
                    <option value="">Elija...</option>
                    @for (p of professionals; track p.id) {
                      <option [ngValue]="p.id">{{ p.name }}</option>
                    }
                  </select>
                </div>
                <div class="col-md-6 d-flex gap-2 flex-wrap">
                  <button class="btn btn-primary" type="button" [disabled]="!selectedProfessionalId || claiming" (click)="claim()">
                    {{ claiming ? 'Guardando...' : 'Tomar cita' }}
                  </button>
                  <button class="btn btn-outline-secondary" type="button" [disabled]="claiming" (click)="clearSelection()">Cancelar</button>
                </div>
              </div>
              @if (claimError) {
                <p class="text-danger small mb-0 mt-2">{{ claimError }}</p>
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
      color: #0f172a;
    }
    :host ::ng-deep .fc-event {
      border-radius: 0.5rem;
      border: none;
      padding: 2px 4px;
      font-size: 0.78rem;
    }
  `,
})
class AppointmentsPageComponent {
  protected page = 0;
  protected size = 50;
  protected total = 0;
  protected loadedCount = 0;
  protected hasNext = false;
  protected statusFilter: AppointmentStatusVm | '' = '';
  protected professionalIdFilter = '';
  protected unassignedOnly = false;
  protected professionals: ProfessionalOptionVm[] = [];
  protected selectedAppointmentId = '';
  protected selectedProfessionalId = '';
  protected claimError = '';
  protected claiming = false;

  protected calendarOptions: CalendarOptions = {
    plugins: [interactionPlugin, dayGridPlugin, timeGridPlugin],
    initialView: 'timeGridWeek',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    },
    events: [],
  };

  constructor(private readonly appointmentsApi: AppointmentsApiService) {
    this.appointmentsApi
      .listProfessionals$()
      .pipe(catchError(() => of([] as ProfessionalOptionVm[])))
      .subscribe((list) => {
        this.professionals = list ?? [];
      });
    this.loadPage();
  }

  protected reloadFromFirstPage(): void {
    this.page = 0;
    this.loadPage();
  }

  protected prevPage(): void {
    if (this.page <= 0) return;
    this.page -= 1;
    this.loadPage();
  }

  protected nextPage(): void {
    if (!this.hasNext) return;
    this.page += 1;
    this.loadPage();
  }

  protected clearSelection(): void {
    this.selectedAppointmentId = '';
    this.selectedProfessionalId = '';
    this.claimError = '';
  }

  protected claim(): void {
    if (!this.selectedAppointmentId || !this.selectedProfessionalId) return;
    this.claiming = true;
    this.claimError = '';
    this.appointmentsApi.claimAppointment$(this.selectedAppointmentId, this.selectedProfessionalId).subscribe({
      next: () => {
        this.claiming = false;
        this.clearSelection();
        this.loadPage();
      },
      error: (err) => {
        this.claiming = false;
        const msg = err?.error?.message ?? err?.message ?? 'No se pudo asignar la cita.';
        this.claimError = typeof msg === 'string' ? msg : JSON.stringify(msg);
      },
    });
  }

  private loadPage(): void {
    this.appointmentsApi
      .listPage$(this.page, this.size, {
        professionalId: this.unassignedOnly ? undefined : this.professionalIdFilter,
        status: this.statusFilter,
        unassignedOnly: this.unassignedOnly,
      })
      .pipe(catchError(() => of({ items: [], page: this.page, size: this.size, total: 0, hasNext: false })))
      .subscribe((result) => {
        this.page = Math.max(0, result.page);
        this.size = Math.max(1, result.size);
        this.total = Math.max(0, result.total);
        this.loadedCount = result.items.length;
        this.hasNext = result.hasNext;
        this.calendarOptions = {
          ...this.calendarOptions,
          events: result.items.map((i) => ({
            id: i.id,
            title: !i.professionalId ? `[Sin asignar] ${i.title}` : i.title,
            start: i.start,
            end: i.end,
          })),
          eventClick: (info) => {
            this.selectedAppointmentId = info.event.id;
            this.selectedProfessionalId = '';
            this.claimError = '';
          },
        };
      });
  }
}

export const APPOINTMENTS_ROUTES: Routes = [{ path: '', component: AppointmentsPageComponent }];
