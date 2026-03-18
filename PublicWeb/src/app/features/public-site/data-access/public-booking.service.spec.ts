import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { PublicBookingService } from './public-booking.service';

describe('PublicBookingService', () => {
  let service: PublicBookingService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PublicBookingService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(PublicBookingService);
    httpTesting = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('maps payment intent response with provider-agnostic checkout fields', async () => {
    const promise = firstValueFrom(service.createPaymentIntent$('booking-123', { providerKey: 'SANDBOX', idempotencyKey: 'idem-1' }));

    const req = httpTesting.expectOne('http://localhost:8080/public/bookings/booking-123/payments/intents');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ providerKey: 'SANDBOX', idempotencyKey: 'idem-1' });
    req.flush({
      id: 'payment-1',
      providerKey: 'SANDBOX',
      providerReference: 'sandbox-ref',
      amount: 95000,
      currency: 'COP',
      status: 'REQUIRES_ACTION',
      providerStatus: 'REQUIRES_ACTION',
      checkoutUrl: 'http://localhost:5174/public/payments/sandbox/booking-123?intent=sandbox-ref',
      clientSecret: 'sandbox_secret',
      failureReason: null,
      expiresAt: '2026-03-18T08:32:18Z',
      confirmationPath: '/booking/confirmation/booking-123'
    });

    await expect(promise).resolves.toEqual({
      id: 'payment-1',
      providerKey: 'SANDBOX',
      providerReference: 'sandbox-ref',
      amount: 95000,
      currency: 'COP',
      status: 'REQUIRES_ACTION',
      providerStatus: 'REQUIRES_ACTION',
      checkoutUrl: 'http://localhost:5174/public/payments/sandbox/booking-123?intent=sandbox-ref',
      clientSecret: 'sandbox_secret',
      failureReason: null,
      expiresAt: '2026-03-18T08:32:18Z',
      confirmationPath: '/booking/confirmation/booking-123'
    });
  });

  it('posts webhook payload and remembers returned booking id', async () => {
    const promise = firstValueFrom(
      service.handlePaymentWebhook$({
        bookingId: 'booking-123',
        providerKey: 'SANDBOX',
        providerReference: 'sandbox-ref',
        status: 'approved',
        eventId: 'evt-1'
      })
    );

    const req = httpTesting.expectOne('http://localhost:8080/public/payments/webhook');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      bookingId: 'booking-123',
      providerKey: 'SANDBOX',
      providerReference: 'sandbox-ref',
      status: 'approved',
      eventId: 'evt-1'
    });
    req.flush({
      id: 'booking-123',
      siteId: 'site-1',
      serviceId: 'general-dentistry',
      serviceName: 'Valoracion dental integral',
      serviceCategory: 'Odontologia',
      patientName: 'Paciente Demo',
      patientEmail: 'paciente@example.com',
      patientPhone: '+573001112233',
      notes: '',
      quotedPrice: 95000,
      appointmentStartAt: '2026-03-19T14:00:00Z',
      appointmentEndAt: '2026-03-19T14:45:00Z',
      status: 'CONFIRMED',
      expiresAt: null,
      appointmentId: 'appointment-1',
      professionalId: 'professional-1',
      timezone: 'America/Bogota',
      payment: {
        id: 'payment-1',
        providerKey: 'SANDBOX',
        providerReference: 'sandbox-ref',
        amount: 95000,
        currency: 'COP',
        status: 'PAID',
        providerStatus: 'approved',
        checkoutUrl: 'http://localhost:5174/public/payments/sandbox/booking-123?intent=sandbox-ref',
        clientSecret: 'sandbox_secret',
        failureReason: null,
        expiresAt: null,
        confirmationPath: '/booking/confirmation/booking-123'
      }
    });

    const booking = await promise;
    expect(booking.id).toBe('booking-123');
    expect(JSON.parse(localStorage.getItem('cop_public_booking_ids') ?? '[]')).toEqual(['booking-123']);
  });
});
