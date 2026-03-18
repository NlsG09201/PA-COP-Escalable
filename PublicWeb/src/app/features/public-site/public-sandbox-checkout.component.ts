import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { PublicBookingService, PublicBookingVm } from './data-access/public-booking.service';

@Component({
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="checkout-shell" data-testid="public-sandbox-checkout">
      <div class="container py-5">
        <div class="checkout-card mx-auto">
          <span class="section-eyebrow">Sandbox checkout</span>
          <h1 class="h3 mt-3 mb-2">Confirma el pago de prueba</h1>
          <p class="text-muted mb-4">
            Esta vista simula el proveedor de pagos y ejecuta el webhook publico para completar la reserva.
          </p>

          @if (errorMessage()) {
            <div class="alert alert-danger" data-testid="sandbox-error-message">{{ errorMessage() }}</div>
          }

          @if (booking(); as booking) {
            @if (booking.status === 'CONFIRMED') {
              <div class="alert alert-success" data-testid="sandbox-already-confirmed">
                La reserva ya quedo confirmada. Puedes revisar el seguimiento o volver al inicio.
              </div>
            }

            @if (intentMismatch()) {
              <div class="alert alert-warning" data-testid="sandbox-intent-mismatch">
                Esta URL corresponde a una referencia distinta a la ultima intencion activa registrada para la reserva.
              </div>
            }

            <div class="detail-grid" data-testid="sandbox-detail-grid">
              <div class="detail-item" data-testid="sandbox-booking-id">
                <span>Reserva</span>
                <strong>{{ booking.id }}</strong>
              </div>
              <div class="detail-item">
                <span>Servicio</span>
                <strong>{{ booking.serviceName }}</strong>
              </div>
              <div class="detail-item">
                <span>Paciente</span>
                <strong>{{ booking.patientName }}</strong>
              </div>
              <div class="detail-item">
                <span>Estado actual</span>
                <strong>{{ booking.status }}</strong>
              </div>
              <div class="detail-item" data-testid="sandbox-payment-status">
                <span>Pago</span>
                <strong>{{ booking.payment?.status ?? 'SIN INTENCION' }}</strong>
              </div>
              <div class="detail-item" data-testid="sandbox-provider-status">
                <span>Estado proveedor</span>
                <strong>{{ booking.payment?.providerStatus ?? 'Pendiente' }}</strong>
              </div>
              <div class="detail-item detail-item-wide">
                <span>Total a pagar</span>
                <strong>{{ booking.quotedPrice | currency: 'COP':'symbol':'1.0-0' }}</strong>
              </div>
              <div class="detail-item detail-item-wide">
                <span>Referencia</span>
                <strong>{{ booking.payment?.providerReference || intentReference() || 'Pendiente' }}</strong>
              </div>
              <div class="detail-item detail-item-wide">
                <span>Client secret</span>
                <strong>{{ booking.payment?.clientSecret ?? 'No disponible' }}</strong>
              </div>
              <div class="detail-item detail-item-wide">
                <span>Horario</span>
                <strong>{{ booking.appointmentStartAt | date: 'full' }}</strong>
              </div>
            </div>

            @if (booking.payment?.failureReason) {
              <div class="alert alert-warning mt-4 mb-0">{{ booking.payment?.failureReason }}</div>
            }

            <div class="action-row">
              <button
                type="button"
                class="btn btn-primary"
                data-testid="sandbox-approve-payment"
                [disabled]="processing() || isTerminalState()"
                (click)="simulatePayment('approved')">
                {{ processing() ? 'Confirmando...' : 'Aprobar pago sandbox' }}
              </button>
              <button
                type="button"
                class="btn btn-outline-danger"
                data-testid="sandbox-reject-payment"
                [disabled]="processing() || isTerminalState()"
                (click)="simulatePayment('failed')">
                Simular rechazo
              </button>
              <a [routerLink]="['/booking/confirmation', booking.id]" class="btn btn-outline-secondary" data-testid="sandbox-view-booking-status">
                Ver seguimiento
              </a>
              <a routerLink="/" class="btn btn-outline-secondary">
                Volver al inicio
              </a>
            </div>
          } @else {
            <div class="detail-item">Cargando checkout sandbox...</div>
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    .checkout-shell {
      min-height: 100vh;
      background:
        radial-gradient(circle at top left, rgba(14, 165, 233, 0.12), transparent 28%),
        radial-gradient(circle at top right, rgba(124, 58, 237, 0.12), transparent 26%),
        #f8fafc;
    }

    .checkout-card {
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

    .action-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }

    @media (max-width: 767px) {
      .detail-grid {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class PublicSandboxCheckoutComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly bookingService = inject(PublicBookingService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly booking = signal<PublicBookingVm | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly processing = signal(false);
  protected readonly intentReference = signal('');
  protected readonly intentMismatch = computed(() => {
    const booking = this.booking();
    const intentReference = this.intentReference();
    return !!intentReference && !!booking?.payment?.providerReference && booking.payment.providerReference !== intentReference;
  });
  protected readonly isTerminalState = computed(() => {
    const booking = this.booking();
    return booking?.status === 'CONFIRMED' || booking?.status === 'CANCELLED' || booking?.status === 'EXPIRED';
  });

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.intentReference.set(params.get('intent') ?? '');
      });

    this.route.paramMap
      .pipe(
        switchMap((params) => this.bookingService.getBooking$(params.get('bookingId') ?? '')),
        catchError(() => {
          this.errorMessage.set('No fue posible cargar la reserva para el checkout sandbox.');
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((booking) => {
        if (booking) {
          this.booking.set(booking);
        }
      });
  }

  protected simulatePayment(status: 'approved' | 'failed'): void {
    const booking = this.booking();
    if (!booking?.payment) {
      this.errorMessage.set('La reserva no tiene una intencion de pago disponible.');
      return;
    }

    this.processing.set(true);
    this.errorMessage.set('');
    this.bookingService
      .handlePaymentWebhook$({
        bookingId: booking.id,
        providerKey: booking.payment.providerKey,
        providerReference: booking.payment.providerReference,
        status,
        eventId: crypto.randomUUID()
      })
      .pipe(
        catchError(() => {
          this.processing.set(false);
          this.errorMessage.set('No fue posible enviar el webhook sandbox.');
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((updatedBooking) => {
        this.processing.set(false);
        if (!updatedBooking) {
          return;
        }

        this.booking.set(updatedBooking);
        if (updatedBooking.status === 'CONFIRMED') {
          this.router.navigateByUrl(updatedBooking.payment?.confirmationPath || `/booking/confirmation/${updatedBooking.id}`);
        }
      });
  }
}
