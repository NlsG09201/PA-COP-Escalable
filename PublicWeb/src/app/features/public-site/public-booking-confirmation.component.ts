import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of, switchMap, takeWhile, timer } from 'rxjs';
import { DASHBOARD_URL } from '../../core/config/dashboard.config';
import { PublicBookingService, PublicBookingVm, PublicNotificationVm } from './data-access/public-booking.service';

@Component({
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="confirmation-shell" data-testid="public-booking-confirmation">
      <div class="container py-5">
        <div class="confirmation-card mx-auto">
          <span class="section-eyebrow">Confirmacion publica</span>
          <h1 class="h3 mt-3 mb-2">Estado de tu reserva</h1>
          <p class="text-muted mb-4">Aqui puedes verificar si el horario quedo reservado y confirmado en el sistema.</p>

          <div class="status-banner" data-testid="confirmation-auto-refresh">
            <div>
              <strong>Actualizacion automatica</strong>
              <p class="mb-0 text-muted small">
                {{ autoRefreshEnabled() ? 'Activa mientras la reserva siga pendiente.' : 'Detenida porque la reserva ya llego a un estado final.' }}
              </p>
            </div>
            <span class="status-pill">{{ lastUpdatedAt() ? ('Actualizado ' + (lastUpdatedAt() | date: 'shortTime')) : 'Sin datos' }}</span>
          </div>

          @if (booking(); as booking) {
            <div
              class="status-summary"
              data-testid="confirmation-status-summary"
              [class.status-summary-success]="statusSummary().tone === 'success'"
              [class.status-summary-danger]="statusSummary().tone === 'danger'">
              <strong>{{ statusSummary().title }}</strong>
              <p class="mb-0">{{ statusSummary().detail }}</p>
            </div>

            <div class="detail-grid" data-testid="confirmation-detail-grid">
              <div class="detail-item">
                <span>Paciente</span>
                <strong>{{ booking.patientName }}</strong>
              </div>
              <div class="detail-item">
                <span>Servicio</span>
                <strong>{{ booking.serviceName }}</strong>
              </div>
              <div class="detail-item" data-testid="confirmation-booking-status">
                <span>Estado</span>
                <strong>{{ booking.status }}</strong>
              </div>
              <div class="detail-item">
                <span>Valor</span>
                <strong>{{ booking.quotedPrice | currency: 'COP':'symbol':'1.0-0' }}</strong>
              </div>
              <div class="detail-item detail-item-wide">
                <span>Fecha y hora</span>
                <strong>{{ booking.appointmentStartAt | date: 'full' }}</strong>
              </div>
              <div class="detail-item detail-item-wide" data-testid="confirmation-payment-status">
                <span>Pago</span>
                <strong>{{ booking.payment?.status ?? 'SIN INTENCION' }}</strong>
              </div>
              <div class="detail-item detail-item-wide" data-testid="confirmation-provider-status">
                <span>Estado proveedor</span>
                <strong>{{ booking.payment?.providerStatus ?? 'Sin sincronizar' }}</strong>
              </div>
              <div class="detail-item detail-item-wide">
                <span>Referencia de checkout</span>
                <strong>{{ booking.payment?.providerReference ?? 'Pendiente de generar' }}</strong>
              </div>
              <div class="detail-item detail-item-wide">
                <span>Checkout sandbox</span>
                <strong>{{ booking.payment?.checkoutUrl ?? 'No disponible' }}</strong>
              </div>
              <div class="detail-item detail-item-wide">
                <span>Motivo de falla</span>
                <strong>{{ booking.payment?.failureReason ?? 'Sin errores reportados' }}</strong>
              </div>
              <div class="detail-item detail-item-wide">
                <span>Vencimiento de pre-reserva</span>
                <strong>{{ booking.expiresAt ? (booking.expiresAt | date: 'full') : 'No aplica' }}</strong>
              </div>
            </div>

            <div class="timeline-block">
              <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
                <div>
                  <span class="section-eyebrow">Trazabilidad</span>
                  <h2 class="h5 mt-2 mb-0">Linea de tiempo de la reserva</h2>
                </div>
                <span class="badge rounded-pill text-bg-light">{{ timeline().length }} eventos</span>
              </div>

              <div class="timeline-list">
                @for (event of timeline(); track event.id) {
                  <article class="timeline-item">
                    <div class="timeline-head">
                      <div>
                        <strong>{{ event.title }}</strong>
                        <p class="mb-0 text-muted small">{{ event.detail }}</p>
                      </div>
                      <span class="status-pill">{{ event.status }}</span>
                    </div>
                    <p class="timeline-meta mb-0">
                      {{ event.at ? (event.at | date: 'medium') : 'Sin fecha registrada' }}
                    </p>
                  </article>
                } @empty {
                  <div class="detail-item">Aun no hay eventos adicionales para esta reserva.</div>
                }
              </div>
            </div>

            <div class="timeline-block">
              <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
                <div>
                  <span class="section-eyebrow">Notificaciones</span>
                  <h2 class="h5 mt-2 mb-0">Envios registrados</h2>
                </div>
                <span class="badge rounded-pill text-bg-light">{{ notifications().length }}</span>
              </div>

              <div class="timeline-list">
                @for (notification of notifications(); track notification.id) {
                  <article class="timeline-item">
                    <div class="timeline-head">
                      <div>
                        <strong>{{ notification.channel }}</strong>
                        <p class="mb-0 text-muted small">
                          {{ notification.recipient || 'Sin destinatario' }} · intento {{ notification.attemptCount }}
                        </p>
                      </div>
                      <span class="status-pill">{{ notification.status }}</span>
                    </div>
                    <p class="timeline-meta mb-1">
                      {{ notification.sentAt ? (notification.sentAt | date: 'medium') : (notification.createdAt ? (notification.createdAt | date: 'medium') : 'Sin fecha registrada') }}
                    </p>
                    @if (notification.providerMessageId) {
                      <p class="mb-1 small text-muted">Mensaje proveedor: {{ notification.providerMessageId }}</p>
                    }
                    @if (notification.errorMessage) {
                      <p class="mb-1 small text-danger">{{ notification.errorMessage }}</p>
                    }
                    @if (notification.templateCode) {
                      <p class="mb-0 small text-muted">Template: {{ notification.templateCode }}</p>
                    }
                  </article>
                } @empty {
                  <div class="detail-item">Todavia no hay notificaciones persistidas para esta reserva.</div>
                }
              </div>
            </div>
          }

          <div class="d-flex flex-wrap gap-3 mt-4">
            <button type="button" class="btn btn-outline-primary" data-testid="confirmation-refresh" (click)="refreshNow()">Actualizar ahora</button>
            @if (booking()?.payment?.checkoutUrl && booking()?.payment?.status !== 'PAID' && booking()?.status !== 'CONFIRMED') {
              <a [href]="booking()?.payment?.checkoutUrl" class="btn btn-primary" data-testid="confirmation-continue-checkout">Continuar checkout sandbox</a>
            }
            <a routerLink="/" class="btn btn-primary">Volver al inicio</a>
            <a [href]="dashboardLoginUrl" class="btn btn-outline-secondary">Ingreso profesional</a>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .confirmation-shell {
      min-height: 100vh;
      background:
        radial-gradient(circle at top left, rgba(14, 165, 233, 0.12), transparent 28%),
        radial-gradient(circle at top right, rgba(124, 58, 237, 0.12), transparent 26%),
        #f8fafc;
    }

    .confirmation-card {
      max-width: 760px;
      border-radius: 1.75rem;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid rgba(148, 163, 184, 0.14);
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.06);
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

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .status-banner {
      margin-bottom: 1.5rem;
      border-radius: 1rem;
      padding: 1rem;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }

    .status-summary {
      margin-bottom: 1.5rem;
      border-radius: 1rem;
      padding: 1rem;
      background: #fff7ed;
      border: 1px solid #fdba74;
      color: #9a3412;
      display: grid;
      gap: 0.35rem;
    }

    .status-summary-success {
      background: #ecfdf5;
      border-color: #6ee7b7;
      color: #047857;
    }

    .status-summary-danger {
      background: #fef2f2;
      border-color: #fca5a5;
      color: #b91c1c;
    }

    .detail-item {
      border-radius: 1rem;
      padding: 1rem;
      background: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.12);
      display: grid;
      gap: 0.3rem;
    }

    .detail-item span {
      color: #64748b;
      font-size: 0.9rem;
    }

    .detail-item-wide {
      grid-column: 1 / -1;
    }

    .timeline-block {
      margin-top: 2rem;
    }

    .timeline-list {
      display: grid;
      gap: 0.9rem;
    }

    .timeline-item {
      border-radius: 1rem;
      padding: 1rem;
      background: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.12);
      display: grid;
      gap: 0.45rem;
    }

    .timeline-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }

    .timeline-meta {
      color: #64748b;
      font-size: 0.85rem;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0.3rem 0.7rem;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 0.78rem;
      font-weight: 700;
      white-space: nowrap;
    }

    @media (max-width: 767px) {
      .detail-grid {
        grid-template-columns: 1fr;
      }

      .status-banner,
      .timeline-head {
        flex-direction: column;
      }
    }
  `
})
export class PublicBookingConfirmationComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly bookingService = inject(PublicBookingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly activeBookingId = signal('');
  protected readonly dashboardLoginUrl = `${DASHBOARD_URL}/login`;

  protected readonly booking = signal<PublicBookingVm | null>(null);
  protected readonly notifications = signal<PublicNotificationVm[]>([]);
  protected readonly lastUpdatedAt = signal<string | null>(null);
  protected readonly autoRefreshEnabled = computed(() => {
    const booking = this.booking();
    if (!booking) {
      return true;
    }
    return booking.status === 'PENDING_PAYMENT' || booking.status === 'DRAFT';
  });
  protected readonly statusSummary = computed(() => {
    const booking = this.booking();
    if (!booking) {
      return {
        tone: 'info',
        title: 'Cargando estado de la reserva',
        detail: 'Estamos consultando la informacion mas reciente.'
      };
    }

    if (booking.status === 'CONFIRMED') {
      return {
        tone: 'success',
        title: 'Reserva confirmada',
        detail: 'Tu cita ya quedo registrada y el pago aparece como aplicado correctamente.'
      };
    }

    if (booking.status === 'EXPIRED') {
      return {
        tone: 'danger',
        title: 'Pre-reserva expirada',
        detail: 'El horario ya no esta bloqueado. Debes volver al inicio y generar una nueva reserva.'
      };
    }

    if (booking.payment?.status === 'FAILED' || booking.payment?.status === 'CANCELLED') {
      return {
        tone: 'danger',
        title: 'Pago no completado',
        detail: booking.payment.failureReason || 'Puedes volver al checkout sandbox o generar una nueva intencion de pago.'
      };
    }

    if (booking.payment?.status === 'PROCESSING') {
      return {
        tone: 'info',
        title: 'Pago en proceso',
        detail: 'Estamos esperando la confirmacion final del proveedor. Esta pantalla se seguira actualizando.'
      };
    }

    return {
      tone: 'info',
      title: 'Checkout pendiente',
      detail: 'Tu horario sigue apartado temporalmente mientras completas el checkout sandbox.'
    };
  });
  protected readonly timeline = computed(() => {
    const booking = this.booking();
    if (!booking) {
      return [];
    }

    const events: TimelineEvent[] = [
      {
        id: `booking-${booking.id}`,
        title: 'Pre-reserva creada',
        detail: `${booking.serviceName} para ${booking.patientName}`,
        status: booking.status,
        at: booking.expiresAt ?? booking.appointmentStartAt
      }
    ];

    if (booking.payment) {
      events.push({
        id: `payment-${booking.payment.id}`,
        title:
          booking.payment.status === 'PAID'
            ? 'Pago aplicado'
            : booking.payment.status === 'FAILED' || booking.payment.status === 'CANCELLED'
              ? 'Pago rechazado'
              : booking.payment.status === 'PROCESSING'
                ? 'Pago en revision'
                : 'Checkout preparado',
        detail:
          booking.payment.failureReason ||
          `${booking.payment.providerKey} · ${booking.payment.providerReference}`,
        status: booking.payment.status,
        at: booking.payment.expiresAt ?? booking.expiresAt
      });
    }

    if (booking.status === 'CONFIRMED') {
      events.push({
        id: `confirmed-${booking.id}`,
        title: 'Reserva confirmada',
        detail: booking.appointmentId ? `Cita clinica ${booking.appointmentId}` : 'Cita confirmada en el sistema',
        status: booking.status,
        at: booking.appointmentStartAt
      });
    }

    return [
      ...events,
      ...this.notifications().map((notification) => ({
        id: `notification-${notification.id}`,
        title: `Notificacion ${notification.channel}`,
        detail: notification.recipient || notification.templateCode || 'Sin detalle',
        status: notification.status,
        at: notification.sentAt ?? notification.createdAt
      }))
    ];
  });

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const bookingId = params.get('bookingId') ?? '';
          this.activeBookingId.set(bookingId);
          return timer(0, 10000).pipe(
            switchMap(() => this.loadBookingBundle$(bookingId)),
            takeWhile(
              (result) => result.booking?.status === 'PENDING_PAYMENT' || result.booking?.status === 'DRAFT',
              true
            )
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ booking, notifications }) => {
        this.booking.set(booking);
        this.notifications.set(notifications);
        this.lastUpdatedAt.set(new Date().toISOString());
      });
  }

  protected refreshNow(): void {
    const bookingId = this.activeBookingId();
    if (!bookingId) {
      return;
    }

    this.loadBookingBundle$(bookingId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ booking, notifications }) => {
        this.booking.set(booking);
        this.notifications.set(notifications);
        this.lastUpdatedAt.set(new Date().toISOString());
      });
  }

  private loadBookingBundle$(bookingId: string) {
    return forkJoin({
      booking: this.bookingService.getBooking$(bookingId),
      notifications: this.bookingService.getBookingNotifications$(bookingId)
    }).pipe(
      catchError(() =>
        of({
          booking: this.booking(),
          notifications: this.notifications()
        })
      )
    );
  }
}

interface TimelineEvent {
  id: string;
  title: string;
  detail: string;
  status: string;
  at: string | null;
}
