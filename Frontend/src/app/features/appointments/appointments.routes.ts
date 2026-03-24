import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FullCalendarModule } from '@fullcalendar/angular';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import { CalendarOptions } from '@fullcalendar/core';
import { Routes } from '@angular/router';
import { AppointmentsApiService, AppointmentStatusVm } from './data-access/appointments-api.service';
import { catchError, of } from 'rxjs';

@Component({
  standalone: true,
  imports: [FullCalendarModule, FormsModule],
  template: `
    <div class="card">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
          <h5 class="card-title mb-0">Gestion de Citas</h5>
          <div class="d-flex align-items-center gap-2">
            <label class="form-label mb-0">Estado</label>
            <select class="form-select form-select-sm" style="width: 140px;" [(ngModel)]="statusFilter" (change)="reloadFromFirstPage()">
              <option [ngValue]="''">Todos</option>
              <option [ngValue]="'REQUESTED'">Requested</option>
              <option [ngValue]="'CONFIRMED'">Confirmed</option>
              <option [ngValue]="'CANCELLED'">Cancelled</option>
              <option [ngValue]="'COMPLETED'">Completed</option>
            </select>
            <label class="form-label mb-0">Profesional</label>
            <input
              class="form-control form-control-sm"
              style="width: 280px;"
              placeholder="UUID profesional (opcional)"
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
        <full-calendar [options]="calendarOptions"></full-calendar>
      </div>
    </div>
  `
})
class AppointmentsPageComponent {
  protected page = 0;
  protected size = 50;
  protected total = 0;
  protected loadedCount = 0;
  protected hasNext = false;
  protected statusFilter: AppointmentStatusVm | '' = '';
  protected professionalIdFilter = '';

  protected calendarOptions: CalendarOptions = {
    plugins: [interactionPlugin, dayGridPlugin, timeGridPlugin],
    initialView: 'timeGridWeek',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    events: []
  };

  constructor(private readonly appointmentsApi: AppointmentsApiService) {
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

  private loadPage(): void {
    this.appointmentsApi
      .listPage$(this.page, this.size, {
        professionalId: this.professionalIdFilter,
        status: this.statusFilter
      })
      .pipe(catchError(() => of({ items: [], page: this.page, size: this.size, total: 0, hasNext: false })))
      .subscribe((result) => {
        this.page = Math.max(0, result.page);
        this.size = Math.max(1, result.size);
        this.total = Math.max(0, result.total);
        this.loadedCount = result.items.length;
        this.hasNext = result.hasNext;
        this.calendarOptions = { ...this.calendarOptions, events: result.items };
      });
  }
}

export const APPOINTMENTS_ROUTES: Routes = [{ path: '', component: AppointmentsPageComponent }];
