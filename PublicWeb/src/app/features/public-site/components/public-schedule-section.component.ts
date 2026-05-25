import { ChangeDetectionStrategy, Component } from '@angular/core';

type ScheduleRow = {
  day: string;
  hours: string;
  detail: string;
};

@Component({
  selector: 'app-public-schedule-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="schedule" class="schedule-section cop-section-block" aria-labelledby="schedule-title">
      <div class="container">
        <div class="schedule-layout">
          <div class="schedule-copy">
            <span class="cop-section-eyebrow">Horarios</span>
            <h2 id="schedule-title" class="cop-section-title">Atencion en horarios amplios y reserva en linea.</h2>
            <p class="cop-section-copy">
              Consulta la agenda disponible por sede y servicio antes de confirmar tu cita. Los cupos reales se
              actualizan en el formulario de reserva.
            </p>
            <a href="#booking" class="btn btn-primary mt-4">Ver horarios disponibles</a>
          </div>

          <div class="schedule-board cop-card" aria-label="Horarios de atencion">
            @for (row of schedule; track row.day) {
              <article class="schedule-row">
                <div>
                  <strong>{{ row.day }}</strong>
                  <span>{{ row.detail }}</span>
                </div>
                <time>{{ row.hours }}</time>
              </article>
            }
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .schedule-section {
      background: var(--cop-brand-light, #e6f4f3);
      border-block: 1px solid rgba(13, 110, 106, 0.12);
    }

    .schedule-layout {
      display: grid;
      grid-template-columns: minmax(0, 0.9fr) minmax(320px, 1.1fr);
      gap: clamp(1.5rem, 4vw, 3rem);
      align-items: center;
    }

    .schedule-copy {
      max-width: 34rem;
    }

    .schedule-copy .cop-section-title,
    .schedule-copy .cop-section-copy {
      text-align: left;
    }

    .schedule-board {
      padding: clamp(1rem, 2.5vw, 1.5rem);
      display: grid;
      gap: 0.75rem;
      border-radius: var(--cop-radius-lg, 1.75rem);
    }

    .schedule-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem;
      border-radius: var(--cop-radius-md, 1.25rem);
      background: #fff;
      border: 1px solid var(--cop-border, rgba(15, 28, 30, 0.08));
    }

    .schedule-row div {
      display: grid;
      gap: 0.15rem;
    }

    .schedule-row strong {
      color: var(--cop-ink, #0f1c1e);
      font-size: 1rem;
    }

    .schedule-row span {
      color: var(--cop-ink-muted, #5c6b6e);
      font-size: 0.9rem;
    }

    .schedule-row time {
      flex-shrink: 0;
      color: var(--cop-brand-dark, #0a5855);
      font-weight: 700;
      white-space: nowrap;
    }

    @media (max-width: 767px) {
      .schedule-layout {
        grid-template-columns: 1fr;
      }

      .schedule-row {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `,
})
export class PublicScheduleSectionComponent {
  protected readonly schedule: ScheduleRow[] = [
    { day: 'Lunes a viernes', hours: '8:00 a.m. - 7:00 p.m.', detail: 'Odontologia y psicologia' },
    { day: 'Sabados', hours: '8:00 a.m. - 2:00 p.m.', detail: 'Atencion programada' },
    { day: 'Domingos y festivos', hours: 'Agenda online 24/7', detail: 'Reserva para el siguiente cupo disponible' },
  ];
}
