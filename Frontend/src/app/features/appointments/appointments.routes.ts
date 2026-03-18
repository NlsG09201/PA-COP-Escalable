import { Component } from '@angular/core';
import { FullCalendarModule } from '@fullcalendar/angular';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import { CalendarOptions } from '@fullcalendar/core';
import { Routes } from '@angular/router';
import { AppointmentsApiService } from './data-access/appointments-api.service';
import { catchError, of } from 'rxjs';

@Component({
  standalone: true,
  imports: [FullCalendarModule],
  template: `
    <div class="card">
      <div class="card-body">
        <h5 class="card-title mb-3">Gestion de Citas</h5>
        <full-calendar [options]="calendarOptions"></full-calendar>
      </div>
    </div>
  `
})
class AppointmentsPageComponent {
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
    this.appointmentsApi
      .list$()
      .pipe(catchError(() => of([])))
      .subscribe((events) => {
      this.calendarOptions = { ...this.calendarOptions, events };
    });
  }
}

export const APPOINTMENTS_ROUTES: Routes = [{ path: '', component: AppointmentsPageComponent }];
