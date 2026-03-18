import { TestBed } from '@angular/core/testing';
import { NEVER, of } from 'rxjs';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { PublicBookingConfirmationComponent } from './public-booking-confirmation.component';
import { PublicBookingService, PublicBookingVm } from './data-access/public-booking.service';

describe('PublicBookingConfirmationComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicBookingConfirmationComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: NEVER
          }
        },
        {
          provide: PublicBookingService,
          useValue: {
            getBooking$: () => of(null),
            getBookingNotifications$: () => of([])
          }
        }
      ]
    }).compileComponents();
  });

  it('builds a success summary and payment timeline for confirmed bookings', () => {
    const fixture = TestBed.createComponent(PublicBookingConfirmationComponent);
    const component = fixture.componentInstance as unknown as {
      booking: { set(value: PublicBookingVm): void };
      notifications: { set(value: unknown[]): void };
      statusSummary: () => { tone: string; title: string; detail: string };
      timeline: () => Array<{ title: string; status: string; detail: string }>;
    };

    component.booking.set(buildBooking({ status: 'CONFIRMED', paymentStatus: 'PAID', providerStatus: 'approved' }));
    component.notifications.set([]);

    expect(component.statusSummary()).toEqual({
      tone: 'success',
      title: 'Reserva confirmada',
      detail: 'Tu cita ya quedo registrada y el pago aparece como aplicado correctamente.'
    });
    expect(component.timeline().map((event) => event.title)).toContain('Pago aplicado');
  });

  it('builds a danger summary when the payment failed', () => {
    const fixture = TestBed.createComponent(PublicBookingConfirmationComponent);
    const component = fixture.componentInstance as unknown as {
      booking: { set(value: PublicBookingVm): void };
      notifications: { set(value: unknown[]): void };
      statusSummary: () => { tone: string; title: string; detail: string };
      timeline: () => Array<{ title: string; status: string; detail: string }>;
    };

    component.booking.set(
      buildBooking({
        status: 'PENDING_PAYMENT',
        paymentStatus: 'FAILED',
        providerStatus: 'rejected',
        failureReason: 'El banco rechazo el intento de pago.'
      })
    );
    component.notifications.set([]);

    expect(component.statusSummary()).toEqual({
      tone: 'danger',
      title: 'Pago no completado',
      detail: 'El banco rechazo el intento de pago.'
    });
    expect(component.timeline().find((event) => event.title === 'Pago rechazado')?.detail).toBe(
      'El banco rechazo el intento de pago.'
    );
  });
});

function buildBooking(options: {
  status: string;
  paymentStatus: string;
  providerStatus: string;
  failureReason?: string | null;
}): PublicBookingVm {
  return {
    id: 'booking-123',
    siteId: 'site-1',
    serviceId: 'general-dentistry',
    serviceName: 'Valoracion dental integral',
    serviceCategory: 'Odontologia',
    patientName: 'Paciente Demo',
    patientEmail: 'paciente@example.com',
    patientPhone: '+573001112233',
    notes: 'Prueba',
    quotedPrice: 95000,
    appointmentStartAt: '2026-03-19T14:00:00Z',
    appointmentEndAt: '2026-03-19T14:45:00Z',
    status: options.status,
    expiresAt: '2026-03-18T08:32:18Z',
    appointmentId: options.status === 'CONFIRMED' ? 'appointment-1' : null,
    professionalId: 'professional-1',
    timezone: 'America/Bogota',
    payment: {
      id: 'payment-1',
      providerKey: 'SANDBOX',
      providerReference: 'sandbox-ref',
      amount: 95000,
      currency: 'COP',
      status: options.paymentStatus,
      providerStatus: options.providerStatus,
      checkoutUrl: 'http://localhost:5174/public/payments/sandbox/booking-123?intent=sandbox-ref',
      clientSecret: 'sandbox_secret',
      failureReason: options.failureReason ?? null,
      expiresAt: '2026-03-18T08:32:18Z',
      confirmationPath: '/booking/confirmation/booking-123'
    }
  };
}
