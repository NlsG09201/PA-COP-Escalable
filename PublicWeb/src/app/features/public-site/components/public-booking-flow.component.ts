import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  PublicAvailabilitySlotVm,
  PublicBookingQuoteVm,
  PublicBookingVm,
  PublicServiceVm,
  PublicSiteVm
} from '../data-access/public-booking.service';
import { PublicSiteFacade } from '../data-access/public-site.facade';

@Component({
  selector: 'app-public-booking-flow',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, ReactiveFormsModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <section id="booking" class="cop-section-block">
      <div class="container">
        <div class="row g-4 align-items-start">
          <div class="col-xl-7">
            <div class="booking-card cop-card">
              <header class="booking-section-head mb-4">
                <span class="cop-section-eyebrow">Agenda online</span>
                <h2 class="cop-section-title text-start">Reserva tu cita en minutos</h2>
                <p class="cop-section-copy text-start">Selecciona sede, servicio, horario y completa la confirmación.</p>
              </header>

              <form [formGroup]="bookingForm" (ngSubmit)="submitBooking.emit()" class="row g-3" data-testid="public-booking-form">
                <div class="col-12">
                  <label class="form-label" for="public-department">Departamento</label>
                  <select
                    id="public-department"
                    class="form-select"
                    [value]="selectedDepartment"
                    (change)="departmentChange.emit($any($event.target).value)"
                    [disabled]="loadingSites">
                    <option value="">Todos</option>
                    @for (dep of departments; track dep) {
                      <option [value]="dep">{{ dep }}</option>
                    }
                  </select>
                </div>
                <div class="col-12">
                  <label class="form-label" for="public-site-search">Buscar sede</label>
                  <input
                    id="public-site-search"
                    class="form-control"
                    placeholder="Nombre, municipio o departamento…"
                    [ngModel]="siteSearch"
                    [ngModelOptions]="{ standalone: true }"
                    (ngModelChange)="siteSearchChange.emit($event)"
                    [disabled]="loadingSites" />
                  <label class="form-label mt-2" for="public-site-select">Sede</label>
                  @if (loadingSites) {
                    <p class="form-text d-flex align-items-center gap-2 mb-1">
                      <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                      Cargando sedes…
                    </p>
                  }
                  <select
                    id="public-site-select"
                    class="form-select"
                    formControlName="siteId"
                    data-testid="public-site-select"
                    (change)="siteChange.emit($any($event.target).value)"
                    [disabled]="loadingSites">
                    <option value="">Seleccione una sede</option>
                    @for (site of sites; track site.id) {
                      <option [value]="site.id">
                        {{ site.name }}@if (site.municipality) { · {{ site.municipality }} }@if (site.department) { ({{ site.department }}) }
                      </option>
                    }
                  </select>
                  <div class="form-text">{{ sites.length }} sedes visibles · {{ totalSitesCount }} en catálogo</div>
                  @if (sitesLoadError) {
                    <div class="text-danger small mt-1" role="alert">
                      {{ sitesLoadError }}
                      <button type="button" class="btn btn-link btn-sm p-0 ms-1" (click)="retryLoadSites.emit()">Reintentar</button>
                    </div>
                  }
                </div>

                <div class="col-12">
                  <label class="form-label" for="public-service-select">Servicio</label>
                  @if (loadingServices) {
                    <p class="form-text d-flex align-items-center gap-2 mb-1">
                      <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                      Cargando servicios…
                    </p>
                  }
                  <select
                    id="public-service-select"
                    class="form-select"
                    formControlName="serviceId"
                    data-testid="public-service-select"
                    (change)="serviceChange.emit($any($event.target).value)"
                    [disabled]="loadingServices || !bookingForm.controls['siteId'].value">
                    <option value="">Seleccione un servicio</option>
                    @for (service of services; track service.id) {
                      <option [value]="service.id">
                        {{ service.title }} - {{ service.category }} - {{ service.priceToPay | currency: 'COP':'symbol':'1.0-0' }} - {{ service.durationMinutes }} min
                      </option>
                    }
                  </select>
                  @if (servicesLoadError) {
                    <div class="text-danger small mt-1" role="alert">
                      {{ servicesLoadError }}
                      <button type="button" class="btn btn-link btn-sm p-0 ms-1" (click)="retryLoadServices.emit()">Reintentar</button>
                    </div>
                  }
                </div>

                <div class="col-12">
                  <label class="form-label">Horarios disponibles</label>
                  @if (loadingAvailability) {
                    <div class="empty-panel text-center py-4" aria-live="polite"><div class="spinner-border text-primary mb-2" role="status"></div><div>Consultando agenda disponible…</div></div>
                  } @else {
                    <div class="calendar" data-testid="public-slot-calendar">
                      @for (day of calendarDays; track day.key) {
                        <section class="calendar-day" [attr.data-day]="day.key">
                          <header class="calendar-day-head">
                            <div class="calendar-day-title">{{ day.label }}</div>
                            <div class="calendar-day-count">{{ day.slots.length }}</div>
                          </header>

                          <div class="calendar-day-body">
                            @for (slot of day.slots; track slot.startAt) {
                              <button
                                type="button"
                                class="calendar-slot"
                                data-testid="public-slot-option"
                                [class.calendar-slot-active]="slot.startAt === selectedSlotStartAt"
                                (click)="slotSelected.emit(slot.startAt)">
                                <strong class="calendar-slot-time">{{ slot.startAt | date: 'h:mm a' }}</strong>
                                @if (slot.professionalName) {
                                  <span class="calendar-slot-pro text-truncate">{{ slot.professionalName }}</span>
                                } @else {
                                  <span class="calendar-slot-pro text-muted">Cupo disponible</span>
                                }
                              </button>
                            } @empty {
                              <div class="calendar-empty">Sin cupos</div>
                            }
                          </div>
                        </section>
                      } @empty {
                        <div class="empty-panel">No hay cupos disponibles para la combinación seleccionada.</div>
                      }
                    </div>
                  }
                </div>

                <div class="col-md-6">
                  <label class="form-label">Nombre completo</label>
                  <input class="form-control" formControlName="patientName" data-testid="public-patient-name" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Teléfono</label>
                  <input class="form-control" formControlName="phone" data-testid="public-patient-phone" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Correo electrónico</label>
                  <input class="form-control" formControlName="email" data-testid="public-patient-email" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Tipo de documento</label>
                  <select class="form-select" formControlName="documentType" data-testid="public-patient-doc-type">
                    <option value="CC">Cédula de ciudadanía</option>
                    <option value="CE">Cédula de extranjería</option>
                    <option value="TI">Tarjeta de identidad</option>
                    <option value="PA">Pasaporte</option>
                    <option value="PPT">Permiso de protección temporal</option>
                    <option value="NIT">NIT</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Número de documento</label>
                  <input class="form-control" formControlName="documentNumber" data-testid="public-patient-document" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Plan de pago</label>
                  <select class="form-select" formControlName="billingMode">
                    <option value="FULL">Pago al contado</option>
                    <option value="INSTALLMENTS">Cuotas (pago por cuota)</option>
                    <option value="QUOTE_CONSULT">Consulta de valoracion / cotizacion</option>
                  </select>
                </div>
                @if (bookingForm.get('billingMode')?.value === 'INSTALLMENTS') {
                  <div class="col-md-6">
                    <label class="form-label">Número de cuotas</label>
                    <input type="number" class="form-control" min="2" max="36" formControlName="installmentCount" />
                  </div>
                }
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
            <div class="summary-card cop-card mb-4">
              <span class="cop-section-eyebrow">Resumen</span>
              <h3 class="h5 mt-2">{{ selectedService?.title ?? 'Sin servicio' }}</h3>
              <p class="text-muted">{{ selectedService?.description ?? 'Selecciona un servicio para ver el detalle.' }}</p>

              @if (loadingQuote && selectedSlotStartAt) {
                <div class="empty-panel">Validando precio y disponibilidad...</div>
              }

              @if (bookingQuote?.billingMode === 'INSTALLMENTS') {
                <div class="summary-metric">
                  <span>Valor total tratamiento (referencia)</span>
                  <strong>{{ (bookingQuote?.totalTreatmentPrice ?? bookingQuote?.basePrice ?? 0) | currency: 'COP':'symbol':'1.0-0' }}</strong>
                </div>
                <div class="summary-metric">
                  <span>Primera cuota a pagar ahora</span>
                  <strong>{{ (bookingQuote?.quotedPrice ?? 0) | currency: 'COP':'symbol':'1.0-0' }}</strong>
                </div>
              } @else {
                <div class="summary-metric">
                  <span>Precio a pagar ahora</span>
                  <strong>{{ (bookingQuote?.quotedPrice ?? selectedService?.priceToPay ?? 0) | currency: 'COP':'symbol':'1.0-0' }}</strong>
                </div>
              }
              <div class="summary-metric">
                <span>Duración</span>
                <strong>{{ selectedService?.durationMinutes ?? 0 }} min</strong>
              </div>
              <div class="summary-metric">
                <span>Promoción</span>
                <strong>{{ (bookingQuote?.promoPrice ?? selectedService?.promoPrice) ? 'Aplicada' : 'Tarifa regular' }}</strong>
              </div>
              <div class="summary-metric">
                <span>Profesional</span>
                <strong>{{ bookingQuote?.professionalName || 'Se asigna desde el panel clinico' }}</strong>
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
                      La pre-reserva expiró y el horario ya no está bloqueado. Debes generar una nueva reserva.
                    </div>
                  } @else if (reservationSuccess.payment?.status === 'FAILED' || reservationSuccess.payment?.status === 'CANCELLED') {
                    <div class="flow-banner flow-banner-danger">
                      El intento de pago no se completo. Puedes actualizar el checkout y reintentar.
                    </div>
                  } @else {
                    <div class="flow-banner">
                      Tu horario está apartado temporalmente. Completa el medio de pago y abre el enlace de cobro para confirmar.
                    </div>
                  }

                  @if (facade.checkoutMethods().length > 0) {
                    <div class="payment-methods-box mb-3">
                      <label class="form-label fw-semibold">Medio de pago (Colombia)</label>
                      <select
                        class="form-select"
                        [ngModel]="facade.selectedProviderKey()"
                        (ngModelChange)="facade.onCheckoutProviderChange($event)">
                        @for (m of facade.checkoutMethods(); track m.key) {
                          <option [ngValue]="m.key">{{ m.label }}</option>
                        }
                      </select>
                      <p class="small text-muted mb-0 mt-2">{{ paymentMethodHint() }}</p>

                      @if (facade.checkoutContext()?.wompiConfigured && facade.selectedProviderKey() !== 'SANDBOX') {
                        <div class="wompi-terms card border-0 shadow-sm mt-3 p-3 bg-light">
                          <button
                            type="button"
                            class="btn btn-sm btn-outline-primary mb-2"
                            [disabled]="facade.loadingWompiPresets()"
                            (click)="facade.loadWompiPresets()">
                            {{ facade.loadingWompiPresets() ? 'Cargando contratos…' : 'Cargar contratos del pasarela (Wompi)' }}
                          </button>
                          @if (facade.wompiPresets(); as wp) {
                            <div class="small mb-2">
                              @if (wp.termsPrivacyUrl) {
                                <a [href]="wp.termsPrivacyUrl" target="_blank" rel="noopener noreferrer">Términos para usuarios</a>
                              }
                              @if (wp.termsPrivacyUrl && wp.termsDataUrl) {
                                <span> · </span>
                              }
                              @if (wp.termsDataUrl) {
                                <a [href]="wp.termsDataUrl" target="_blank" rel="noopener noreferrer">Tratamiento de datos</a>
                              }
                            </div>
                            <div class="form-check">
                              <input
                                class="form-check-input"
                                type="checkbox"
                                id="wompi-accept"
                                [checked]="facade.wompiTermsAccepted()"
                                (change)="facade.toggleWompiTerms($any($event.target).checked)" />
                              <label class="form-check-label small" for="wompi-accept">Acepto contratos para procesar el cobro</label>
                            </div>
                          }
                        </div>
                      }

                      @if (facade.needsWalletPhone()) {
                        <label class="form-label mt-3">Celular (Nequi / Daviplata)</label>
                        <input
                          class="form-control"
                          placeholder="3001234567"
                          [ngModel]="facade.walletPhone()"
                          (ngModelChange)="facade.setWalletPhone($event)" />
                      }
                      @if (facade.needsPse()) {
                        <label class="form-label mt-3">Documento pagador (PSE)</label>
                        <input
                          class="form-control"
                          placeholder="Número de cédula"
                          [ngModel]="facade.pseLegalId()"
                          (ngModelChange)="facade.setPseLegalId($event)" />
                      }
                      @if (facade.needsCard()) {
                        <label class="form-label mt-3">Token de tarjeta (widget PSP)</label>
                        <textarea
                          class="form-control"
                          rows="2"
                          placeholder="Pegue el token generado por Wompi.js / checkout seguro — no PAN ni CVC"
                          [ngModel]="facade.cardPaymentToken()"
                          (ngModelChange)="facade.setCardToken($event)"></textarea>
                      }
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
                      <span>Enlace de cobro</span>
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
                              : facade.selectedProviderKey() === 'SANDBOX'
                                ? 'Abrir checkout prueba'
                                : 'Ir al banco / pasarela'
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

            <div class="summary-card cop-card">
              <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
                <div>
                  <span class="cop-section-eyebrow">Panel de usuario</span>
                  <h3 class="h5 mt-2 mb-0">Reservas recientes</h3>
                </div>
                <span class="badge rounded-pill text-bg-light">{{ bookings.length }}</span>
              </div>

              <div class="booking-list" data-testid="public-recent-bookings">
                @for (booking of bookings; track booking.id) {
                  <article class="booking-item">
                    <div class="booking-item-head">
                      <div class="booking-item-title">
                        <strong class="text-truncate d-block">{{ booking.serviceName }}</strong>
                        <span class="text-muted small text-truncate d-block">{{ booking.patientName }}</span>
                      </div>
                      <div class="booking-item-badges">
                        <span class="status-badge" [attr.data-status]="booking.status">{{ booking.status }}</span>
                        <span class="payment-badge" [attr.data-payment]="booking.payment?.status ?? 'NONE'">
                          {{ booking.payment?.status ?? 'SIN PAGO' }}
                        </span>
                      </div>
                    </div>

                    <div class="booking-item-meta">
                      <div class="meta-pill">
                        <span class="meta-label">Fecha</span>
                        <strong>{{ booking.appointmentStartAt | date: 'EEE d MMM, h:mm a' }}</strong>
                      </div>
                      <div class="meta-pill">
                        <span class="meta-label">Valor</span>
                        <strong>{{ booking.quotedPrice | currency: 'COP':'symbol':'1.0-0' }}</strong>
                      </div>
                    </div>

                    <a
                      [routerLink]="['/booking/confirmation', booking.id]"
                      class="stretched-link booking-item-link"
                      aria-label="Ver estado de la reserva">
                      Ver estado
                    </a>
                  </article>
                } @empty {
                  <div class="empty-panel">Aún no hay reservas públicas registradas desde este navegador.</div>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .booking-section-head .cop-section-title {
      margin-top: 0.65rem;
    }

    .booking-card,
    .summary-card {
      height: 100%;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
    }

    .booking-list,
    .calendar,
    .booking-list {
      display: grid;
      gap: 0.85rem;
    }

    .calendar {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      align-items: start;
    }

    .calendar-day {
      border-radius: var(--cop-radius-md, 1.25rem);
      border: 1px solid var(--cop-border);
      background: var(--cop-surface-elevated, #fff);
      box-shadow: var(--cop-shadow-sm);
      overflow: hidden;
      min-height: 260px;
      display: grid;
      grid-template-rows: auto 1fr;
    }

    .calendar-day-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 0.95rem;
      background: linear-gradient(180deg, var(--cop-brand-light, #e6f4f3) 0%, rgba(230, 244, 243, 0.35) 100%);
      border-bottom: 1px solid var(--cop-border);
    }

    .calendar-day-title {
      font-weight: 900;
      letter-spacing: 0.02em;
      color: #0f172a;
      text-transform: uppercase;
      font-size: 0.78rem;
    }

    .calendar-day-count {
      min-width: 2rem;
      height: 1.65rem;
      padding: 0 0.55rem;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 0.78rem;
      color: var(--cop-brand-dark, #0a5855);
      background: rgba(255, 255, 255, 0.85);
      border: 1px solid rgba(13, 110, 106, 0.25);
      flex-shrink: 0;
    }

    .calendar-day-body {
      padding: 0.85rem;
      display: grid;
      gap: 0.55rem;
      align-content: start;
      max-height: 360px;
      overflow: auto;
    }

    .calendar-slot {
      width: 100%;
      min-height: 44px;
      text-align: left;
      border-radius: 1rem;
      padding: 0.75rem 0.85rem;
      border: 1px solid rgba(148, 163, 184, 0.18);
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      display: grid;
      gap: 0.1rem;
      transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
    }

    .calendar-slot:hover {
      transform: translateY(-1px);
      border-color: rgba(13, 110, 106, 0.28);
      box-shadow: var(--cop-shadow-sm);
    }

    .calendar-slot-time {
      font-size: 1.05rem;
      letter-spacing: -0.01em;
      color: #0f172a;
    }

    .calendar-slot-pro {
      font-size: 0.85rem;
      color: #64748b;
    }

    .calendar-slot-active {
      border-color: var(--cop-brand, #0d6e6a);
      background: var(--cop-brand-light, #e6f4f3);
      box-shadow: var(--cop-shadow-sm);
    }

    .calendar-empty {
      border-radius: 1rem;
      padding: 0.85rem;
      background: #f8fafc;
      border: 1px dashed rgba(148, 163, 184, 0.35);
      color: #64748b;
      text-align: center;
      font-weight: 700;
      font-size: 0.9rem;
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
      padding: 1rem;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border: 1px solid rgba(148, 163, 184, 0.14);
      position: relative;
      transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
      overflow: hidden;
    }

    .booking-item:hover {
      transform: translateY(-1px);
      border-color: rgba(13, 110, 106, 0.22);
      box-shadow: var(--cop-shadow-sm);
    }

    .booking-item-head {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }

    .booking-item-title {
      min-width: 0;
      display: grid;
      gap: 0.15rem;
    }

    .booking-item-badges {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.35rem;
      flex-shrink: 0;
    }

    .status-badge,
    .payment-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      font-weight: 800;
      font-size: 0.72rem;
      letter-spacing: 0.03em;
      border: 1px solid transparent;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .status-badge[data-status="CONFIRMED"] {
      background: #ecfdf5;
      color: #047857;
      border-color: rgba(5, 150, 105, 0.25);
    }
    .status-badge[data-status="PENDING_PAYMENT"] {
      background: var(--cop-accent-soft, #e8f2f8);
      color: var(--cop-accent, #1e6b9a);
      border-color: rgba(30, 107, 154, 0.25);
    }
    .status-badge[data-status="REQUESTED"] {
      background: #f8fafc;
      color: #334155;
      border-color: rgba(148, 163, 184, 0.35);
    }
    .status-badge[data-status="EXPIRED"],
    .status-badge[data-status="CANCELLED"] {
      background: #fef2f2;
      color: #b91c1c;
      border-color: rgba(239, 68, 68, 0.25);
    }

    .payment-badge[data-payment="PAID"] {
      background: #ecfdf5;
      color: #065f46;
      border-color: rgba(5, 150, 105, 0.18);
    }
    .payment-badge[data-payment="REQUIRES_ACTION"],
    .payment-badge[data-payment="PENDING"],
    .payment-badge[data-payment="NONE"] {
      background: #fff7ed;
      color: #9a3412;
      border-color: rgba(234, 88, 12, 0.22);
    }
    .payment-badge[data-payment="FAILED"],
    .payment-badge[data-payment="CANCELLED"] {
      background: #fef2f2;
      color: #991b1b;
      border-color: rgba(239, 68, 68, 0.22);
    }

    .booking-item-meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.65rem;
    }

    .meta-pill {
      border-radius: 0.9rem;
      padding: 0.65rem 0.75rem;
      background: rgba(248, 250, 252, 0.85);
      border: 1px solid rgba(148, 163, 184, 0.14);
      display: grid;
      gap: 0.1rem;
      min-width: 0;
    }

    .meta-label {
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .booking-item-link {
      display: inline-flex;
      margin-top: 0.75rem;
      font-weight: 800;
      text-decoration: none;
      color: var(--cop-brand, #0d6e6a);
    }

    @media (max-width: 575px) {
      .booking-item-meta {
        grid-template-columns: 1fr;
      }
      .booking-item-badges {
        align-items: flex-start;
      }
      .booking-item-head {
        flex-direction: column;
        align-items: stretch;
      }
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

    .payment-methods-box {
      border-radius: 1rem;
      padding: 1rem;
      background: rgba(248, 250, 252, 0.95);
      border: 1px solid rgba(148, 163, 184, 0.2);
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
      .calendar {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 575px) {
      .calendar {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class PublicBookingFlowComponent {
  protected readonly facade = inject(PublicSiteFacade);

  readonly paymentMethodHint = computed(() =>
    this.facade.checkoutMethods().find((m) => m.key === this.facade.selectedProviderKey())?.description ?? '',
  );

  @Input({ required: true }) bookingForm!: FormGroup;
  @Input() departments: string[] = [];
  @Input() selectedDepartment = '';
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
  @Input() loadingSites = false;
  @Input() loadingServices = false;
  @Input() sitesLoadError = '';
  @Input() servicesLoadError = '';
  @Input() siteSearch = '';
  @Input() totalSitesCount = 0;
  @Input() preparingCheckout = false;
  @Input() submitting = false;
  @Input() processingPayment = false;

  @Output() readonly departmentChange = new EventEmitter<string>();
  @Output() readonly siteSearchChange = new EventEmitter<string>();
  @Output() readonly retryLoadSites = new EventEmitter<void>();
  @Output() readonly retryLoadServices = new EventEmitter<void>();
  @Output() readonly siteChange = new EventEmitter<string>();
  @Output() readonly serviceChange = new EventEmitter<string>();
  @Output() readonly slotSelected = new EventEmitter<string>();
  @Output() readonly submitBooking = new EventEmitter<void>();
  @Output() readonly prepareCheckout = new EventEmitter<void>();
  @Output() readonly payNow = new EventEmitter<void>();

  get calendarDays(): Array<{ key: string; label: string; slots: PublicAvailabilitySlotVm[] }> {
    const byDay = new Map<string, PublicAvailabilitySlotVm[]>();

    for (const slot of this.slots ?? []) {
      const d = new Date(slot.startAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = d.toISOString().slice(0, 10); // yyyy-mm-dd
      const arr = byDay.get(key) ?? [];
      arr.push(slot);
      byDay.set(key, arr);
    }

    const dayKeys = Array.from(byDay.keys()).sort();
    const fmt = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });

    return dayKeys.map((key) => {
      const d = new Date(key + 'T00:00:00');
      const slots = (byDay.get(key) ?? []).slice().sort((a, b) => a.startAt.localeCompare(b.startAt));
      return { key, label: fmt.format(d).toUpperCase(), slots };
    });
  }
}
