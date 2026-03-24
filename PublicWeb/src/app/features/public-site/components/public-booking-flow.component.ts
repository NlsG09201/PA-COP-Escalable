import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  PublicAvailabilitySlotVm,
  PublicBookingQuoteVm,
  PublicBookingVm,
  PublicServiceVm,
  PublicSiteVm
} from '../data-access/public-booking.service';

@Component({
  selector: 'app-public-booking-flow',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="booking" class="section-block">
      <div class="container">
        <div class="row g-4 align-items-start">
          <div class="col-xl-7">
            <div class="booking-card">
              <div class="section-head text-start mb-4">
                <span class="section-eyebrow">Agenda online</span>
                <h2>Reserva tu cita en minutos</h2>
                <p>Selecciona sede, servicio, horario y completa el checkout de confirmacion.</p>
              </div>

              <form [formGroup]="bookingForm" (ngSubmit)="submitBooking.emit()" class="row g-3" data-testid="public-booking-form">
                <div class="col-md-6">
                  <label class="form-label">Sede</label>
                  <select
                    class="form-select"
                    formControlName="siteId"
                    data-testid="public-site-select"
                    (change)="siteChange.emit($any($event.target).value)">
                    @for (site of sites; track site.id) {
                      <option [value]="site.id">{{ site.name }}</option>
                    }
                  </select>
                </div>

                <div class="col-md-6">
                  <label class="form-label">Servicio</label>
                  <select
                    class="form-select"
                    formControlName="serviceId"
                    data-testid="public-service-select"
                    (change)="serviceChange.emit($any($event.target).value)">
                    @for (service of services; track service.id) {
                      <option [value]="service.id">
                        {{ service.title }} - {{ service.category }} - {{ service.priceToPay | currency: 'COP':'symbol':'1.0-0' }} - {{ service.durationMinutes }} min
                      </option>
                    }
                  </select>
                </div>

                <div class="col-12">
                  <label class="form-label">Horarios disponibles</label>
                  @if (loadingAvailability) {
                    <div class="empty-panel">Consultando agenda disponible...</div>
                  } @else {
                    <div class="slot-grid" data-testid="public-slot-grid">
                      @for (slot of slots; track slot.startAt) {
                        <button
                          type="button"
                          class="slot-chip"
                          data-testid="public-slot-option"
                          [class.slot-chip-active]="slot.startAt === selectedSlotStartAt"
                          (click)="slotSelected.emit(slot.startAt)">
                          <strong>{{ slot.startAt | date: 'EEE d MMM, h:mm a' }}</strong>
                          <span>{{ slot.professionalName }}</span>
                        </button>
                      } @empty {
                        <div class="empty-panel">No hay cupos disponibles para la combinacion seleccionada.</div>
                      }
                    </div>
                  }
                </div>

                <div class="col-md-6">
                  <label class="form-label">Nombre completo</label>
                  <input class="form-control" formControlName="patientName" data-testid="public-patient-name" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Telefono</label>
                  <input class="form-control" formControlName="phone" data-testid="public-patient-phone" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Correo electronico</label>
                  <input class="form-control" formControlName="email" data-testid="public-patient-email" />
                </div>
                <div class="col-12">
                  <label class="form-label">Observaciones</label>
                  <textarea
                    class="form-control"
                    rows="4"
                    formControlName="notes"
                    data-testid="public-patient-notes"
                    placeholder="Motivo de consulta o comentarios"></textarea>
                </div>
                <div class="col-12 d-flex flex-wrap justify-content-between align-items-center gap-3">
                  <p class="mb-0 text-muted small">
                    La pre-reserva bloquea el horario por {{ bookingQuote?.holdMinutes ?? 15 }} minutos y deja la cita en estado {{ bookingQuote?.nextStatus ?? 'PENDING_PAYMENT' }}.
                  </p>
                  <button
                    class="btn btn-primary px-4"
                    data-testid="public-create-booking"
                    [disabled]="bookingForm.invalid || submitting || loadingQuote || !selectedSlotStartAt || !bookingQuote">
                    {{ submitting ? 'Generando reserva...' : 'Crear reserva' }}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div class="col-xl-5">
            <div class="summary-card mb-4">
              <span class="section-eyebrow">Resumen</span>
              <h3 class="h5 mt-2">{{ selectedService?.title ?? 'Sin servicio' }}</h3>
              <p class="text-muted">{{ selectedService?.description ?? 'Selecciona un servicio para ver el detalle.' }}</p>

              @if (loadingQuote && selectedSlotStartAt) {
                <div class="empty-panel">Validando precio y profesional disponible...</div>
              }

              <div class="summary-metric">
                <span>Precio final</span>
                <strong>{{ (bookingQuote?.quotedPrice ?? selectedService?.priceToPay ?? 0) | currency: 'COP':'symbol':'1.0-0' }}</strong>
              </div>
              <div class="summary-metric">
                <span>Duracion</span>
                <strong>{{ selectedService?.durationMinutes ?? 0 }} min</strong>
              </div>
              <div class="summary-metric">
                <span>Promocion</span>
                <strong>{{ (bookingQuote?.promoPrice ?? selectedService?.promoPrice) ? 'Aplicada' : 'Tarifa regular' }}</strong>
              </div>
              <div class="summary-metric">
                <span>Profesional asignable</span>
                <strong>{{ bookingQuote?.professionalName ?? 'Se definira al cotizar' }}</strong>
              </div>
              <div class="summary-metric">
                <span>Horario cotizado</span>
                <strong>{{ bookingQuote?.slotStartAt ? (bookingQuote?.slotStartAt | date: 'EEE d MMM, h:mm a') : 'Selecciona un horario' }}</strong>
              </div>

              @if (reservationSuccess) {
                <div class="success-box" data-testid="public-booking-success">
                  <strong>Reserva creada</strong>
                  <p class="mb-1">{{ reservationSuccess.patientName }} - {{ reservationSuccess.serviceName }}</p>
                  <p class="mb-2 text-muted">{{ reservationSuccess.appointmentStartAt | date: 'full' }}</p>
                  @if (reservationSuccess.status === 'CONFIRMED') {
                    <div class="flow-banner flow-banner-success">
                      Tu cita ya fue confirmada. Puedes revisar el seguimiento completo cuando quieras.
                    </div>
                  } @else if (reservationSuccess.status === 'EXPIRED') {
                    <div class="flow-banner flow-banner-danger">
                      La pre-reserva expiro y el horario ya no esta bloqueado. Debes generar una nueva reserva.
                    </div>
                  } @else if (reservationSuccess.payment?.status === 'FAILED' || reservationSuccess.payment?.status === 'CANCELLED') {
                    <div class="flow-banner flow-banner-danger">
                      El intento de pago no se completo. Puedes actualizar el checkout y reintentar.
                    </div>
                  } @else {
                    <div class="flow-banner">
                      Tu horario esta apartado temporalmente. Abre el checkout sandbox para confirmar la reserva.
                    </div>
                  }
                  <div class="checkout-box" data-testid="public-checkout-summary">
                    <div class="checkout-line">
                      <span>Estado del checkout</span>
                      <strong>{{ reservationSuccess.payment?.status ?? 'SIN PREPARAR' }}</strong>
                    </div>
                    <div class="checkout-line">
                      <span>Estado proveedor</span>
                      <strong>{{ reservationSuccess.payment?.providerStatus ?? 'Pendiente' }}</strong>
                    </div>
                    <div class="checkout-line">
                      <span>Referencia</span>
                      <strong>{{ reservationSuccess.payment?.providerReference ?? 'Pendiente' }}</strong>
                    </div>
                    <div class="checkout-line">
                      <span>Checkout sandbox</span>
                      <strong>{{ reservationSuccess.payment?.checkoutUrl ? 'Listo para abrir' : 'Pendiente' }}</strong>
                    </div>
                    <div class="checkout-line">
                      <span>Vence</span>
                      <strong>{{ reservationSuccess.expiresAt ? (reservationSuccess.expiresAt | date: 'short') : 'Sin vencimiento' }}</strong>
                    </div>
                    @if (reservationSuccess.payment?.failureReason) {
                      <p class="mb-0 small text-danger">{{ reservationSuccess.payment?.failureReason }}</p>
                    }
                  </div>
                  <div class="d-flex flex-wrap gap-2">
                    <button
                      class="btn btn-outline-primary btn-sm"
                      type="button"
                      data-testid="public-prepare-checkout"
                      [disabled]="preparingCheckout || reservationSuccess.status === 'EXPIRED'"
                      (click)="prepareCheckout.emit()">
                      {{ preparingCheckout ? 'Preparando checkout...' : ((reservationSuccess.payment?.status === 'FAILED' || reservationSuccess.payment?.status === 'CANCELLED') ? 'Reintentar checkout' : 'Actualizar checkout') }}
                    </button>
                    <button
                      class="btn btn-primary btn-sm"
                      type="button"
                      data-testid="public-open-checkout"
                      [disabled]="processingPayment || preparingCheckout || !reservationSuccess.payment || reservationSuccess.status === 'EXPIRED' || reservationSuccess.status === 'CONFIRMED' || reservationSuccess.payment.status === 'PAID'"
                      (click)="payNow.emit()">
                      {{
                        processingPayment
                          ? 'Abriendo checkout...'
                          : reservationSuccess.payment?.status === 'FAILED' || reservationSuccess.payment?.status === 'CANCELLED'
                            ? 'Reabrir checkout sandbox'
                            : reservationSuccess.payment?.status === 'PAID' || reservationSuccess.status === 'CONFIRMED'
                              ? 'Pago confirmado'
                              : 'Abrir checkout sandbox'
                      }}
                    </button>
                    <a
                      [routerLink]="['/booking/confirmation', reservationSuccess.id]"
                      class="btn btn-outline-secondary btn-sm"
                      data-testid="public-view-booking-status">
                      Ver seguimiento
                    </a>
                  </div>
                </div>
              }
            </div>

            <div class="summary-card">
              <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
                <div>
                  <span class="section-eyebrow">Panel de usuario basico</span>
                  <h3 class="h5 mt-2 mb-0">Reservas recientes</h3>
                </div>
                <span class="badge rounded-pill text-bg-light">{{ bookings.length }}</span>
              </div>

              <div class="booking-list" data-testid="public-recent-bookings">
                @for (booking of bookings; track booking.id) {
                  <article class="booking-item">
                    <div class="d-flex justify-content-between gap-2">
                      <strong>{{ booking.serviceName }}</strong>
                      <span class="badge rounded-pill text-bg-warning">{{ booking.status }}</span>
                    </div>
                    <p class="mb-1">{{ booking.patientName }} · {{ booking.quotedPrice | currency: 'COP':'symbol':'1.0-0' }}</p>
                    <p class="mb-1 small text-muted">Pago: {{ booking.payment?.status ?? 'SIN INTENCION' }}</p>
                    <p class="mb-0 text-muted small">{{ booking.appointmentStartAt | date: 'short' }}</p>
                    <a [routerLink]="['/booking/confirmation', booking.id]" class="stretched-link mt-2 small fw-semibold text-decoration-none">
                      Ver estado
                    </a>
                  </article>
                } @empty {
                  <div class="empty-panel">Aun no hay reservas publicas registradas desde este navegador.</div>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .section-block {
      padding: 1.5rem 0 4rem;
    }

    .section-head h2 {
      font-size: clamp(1.8rem, 4vw, 3rem);
      line-height: 1.1;
      margin: 0.85rem 0;
      font-weight: 800;
    }

    .section-head p {
      color: #64748b;
      font-size: 1rem;
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

    .booking-card,
    .summary-card {
      height: 100%;
      border-radius: 1.6rem;
      padding: 1.5rem;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(148, 163, 184, 0.14);
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.06);
      display: flex;
      flex-direction: column;
    }

    .slot-grid,
    .booking-list {
      display: grid;
      gap: 0.85rem;
    }

    .slot-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .slot-chip {
      text-align: left;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 1rem;
      padding: 0.85rem;
      background: #fff;
      display: grid;
      gap: 0.25rem;
    }

    .slot-chip span {
      color: #64748b;
      font-size: 0.85rem;
    }

    .slot-chip-active {
      border-color: #2563eb;
      background: #eff6ff;
    }

    .summary-metric {
      border-radius: 1.25rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.16);
      display: grid;
      gap: 0.25rem;
      margin-bottom: 0.85rem;
    }

    .summary-metric span {
      color: #64748b;
      font-size: 0.9rem;
    }

    .booking-item {
      border-radius: 1rem;
      padding: 0.9rem;
      background: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.12);
      position: relative;
    }

    .checkout-box {
      display: grid;
      gap: 0.65rem;
      margin: 1rem 0;
      padding: 0.9rem;
      border-radius: 1rem;
      background: rgba(255, 255, 255, 0.72);
      border: 1px solid rgba(148, 163, 184, 0.18);
    }

    .flow-banner {
      margin-bottom: 1rem;
      border-radius: 1rem;
      padding: 0.85rem 1rem;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      font-size: 0.92rem;
    }

    .flow-banner-success {
      background: #ecfdf5;
      border-color: #6ee7b7;
      color: #047857;
    }

    .flow-banner-danger {
      background: #fef2f2;
      border-color: #fca5a5;
      color: #b91c1c;
    }

    .checkout-line {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      font-size: 0.92rem;
    }

    .checkout-line span {
      color: #64748b;
    }

    .success-box,
    .empty-panel {
      margin-top: 1.25rem;
      border-radius: 1rem;
      padding: 1rem;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
    }

    .empty-panel {
      background: #f8fafc;
      border-color: #e2e8f0;
      color: #64748b;
    }

    @media (max-width: 991px) {
      .slot-grid {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class PublicBookingFlowComponent {
  @Input({ required: true }) bookingForm!: FormGroup;
  @Input() sites: PublicSiteVm[] = [];
  @Input() services: PublicServiceVm[] = [];
  @Input() slots: PublicAvailabilitySlotVm[] = [];
  @Input() bookings: PublicBookingVm[] = [];
  @Input() bookingQuote: PublicBookingQuoteVm | null = null;
  @Input() selectedService: PublicServiceVm | null = null;
  @Input() selectedSlotStartAt = '';
  @Input() reservationSuccess: PublicBookingVm | null = null;
  @Input() loadingAvailability = false;
  @Input() loadingQuote = false;
  @Input() preparingCheckout = false;
  @Input() submitting = false;
  @Input() processingPayment = false;

  @Output() readonly siteChange = new EventEmitter<string>();
  @Output() readonly serviceChange = new EventEmitter<string>();
  @Output() readonly slotSelected = new EventEmitter<string>();
  @Output() readonly submitBooking = new EventEmitter<void>();
  @Output() readonly prepareCheckout = new EventEmitter<void>();
  @Output() readonly payNow = new EventEmitter<void>();
}
