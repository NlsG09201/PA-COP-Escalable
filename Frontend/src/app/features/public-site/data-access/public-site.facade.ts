import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import {
  PublicAvailabilitySlotVm,
  PublicBookingQuoteVm,
  PublicBookingService,
  PublicBookingVm,
  PublicPaymentVm,
  PublicServiceVm,
  PublicSiteVm
} from './public-booking.service';

@Injectable()
export class PublicSiteFacade {
  private readonly bookingService = inject(PublicBookingService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly sites = signal<PublicSiteVm[]>([]);
  readonly services = signal<PublicServiceVm[]>([]);
  readonly availabilitySlots = signal<PublicAvailabilitySlotVm[]>([]);
  readonly recentBookings = signal<PublicBookingVm[]>([]);
  readonly bookingQuote = signal<PublicBookingQuoteVm | null>(null);
  readonly reservationSuccess = signal<PublicBookingVm | null>(null);
  readonly loadingAvailability = signal(false);
  readonly loadingQuote = signal(false);
  readonly preparingCheckout = signal(false);
  readonly submitting = signal(false);
  readonly processingPayment = signal(false);
  readonly loadingSites = signal(true);
  readonly loadingServices = signal(false);
  readonly pageError = signal('');
  readonly selectedSiteId = signal('');
  readonly selectedServiceId = signal('');

  readonly bookingForm = this.fb.nonNullable.group({
    siteId: ['', [Validators.required]],
    serviceId: ['', [Validators.required]],
    slotStartAt: ['', [Validators.required]],
    patientName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.minLength(7), Validators.pattern(/^[0-9+\-\s()]+$/)]],
    notes: ['']
  });

  readonly selectedService = computed(
    () => this.services().find((service) => service.id === this.selectedServiceId()) ?? null
  );

  readonly hasCatalogData = computed(() => this.sites().length > 0 || this.services().length > 0);

  constructor() {
    this.loadSites();
    this.loadRecentBookings();

    this.bookingForm.controls.siteId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((siteId) => {
      if (!siteId) {
        this.selectedSiteId.set('');
        this.services.set([]);
        this.availabilitySlots.set([]);
        this.bookingQuote.set(null);
        return;
      }

      this.selectedSiteId.set(siteId);
      this.loadServices(siteId);
    });

    this.bookingForm.controls.serviceId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((serviceId) => {
      this.selectedServiceId.set(serviceId);
      this.bookingForm.controls.slotStartAt.setValue('');
      this.bookingQuote.set(null);
      this.loadAvailability();
    });

    this.bookingForm.controls.slotStartAt.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.reservationSuccess.set(null);
      this.loadQuote();
    });
  }

  onSiteSelected(siteId: string): void {
    this.clearFlowMessages();
    this.bookingForm.controls.siteId.setValue(siteId);
  }

  onServiceSelected(serviceId: string): void {
    this.clearFlowMessages();
    this.bookingForm.controls.serviceId.setValue(serviceId);
  }

  bookAppointment(): void {
    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      return;
    }

    if (!this.bookingQuote()) {
      this.loadQuote();
      return;
    }

    this.submitting.set(true);
    this.pageError.set('');
    const { siteId, serviceId, slotStartAt, patientName, email, phone, notes } = this.bookingForm.getRawValue();

    this.bookingService
      .createBooking$({
        siteId,
        serviceId,
        slotStartAt,
        patientName,
        email,
        phone,
        notes,
        idempotencyKey: crypto.randomUUID()
      })
      .pipe(
        catchError((error) => {
          this.submitting.set(false);
          this.pageError.set(this.toUserMessage(error, 'No fue posible crear la reserva.'));
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((booking) => {
        this.submitting.set(false);
        if (!booking) {
          return;
        }

        this.reservationSuccess.set(booking);
        this.bookingQuote.set(null);
        this.prepareCheckout(booking);
      });
  }

  prepareCheckout(sourceBooking?: PublicBookingVm): void {
    const booking = sourceBooking ?? this.reservationSuccess();
    if (!booking || booking.status === 'EXPIRED') {
      return;
    }

    this.preparingCheckout.set(true);
    this.pageError.set('');
    this.bookingService
      .createPaymentIntent$(booking.id, { idempotencyKey: crypto.randomUUID() })
      .pipe(
        catchError((error) => {
          this.preparingCheckout.set(false);
          this.pageError.set(this.toUserMessage(error, 'No fue posible preparar el checkout.'));
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((payment) => {
        this.preparingCheckout.set(false);
        if (!payment) {
          return;
        }

        this.patchReservationPayment(payment);
      });
  }

  completePayment(): void {
    const booking = this.reservationSuccess();
    if (!booking) {
      return;
    }

    this.processingPayment.set(true);
    this.pageError.set('');
    this.bookingService
      .completePayment$(booking.id)
      .pipe(
        catchError((error) => {
          this.processingPayment.set(false);
          this.pageError.set(this.toUserMessage(error, 'No fue posible confirmar el pago sandbox.'));
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((confirmed) => {
        this.processingPayment.set(false);
        if (!confirmed) {
          return;
        }

        this.reservationSuccess.set(confirmed);
        this.router.navigateByUrl(`/booking/confirmation/${confirmed.id}`);
      });
  }

  private loadSites(): void {
    this.loadingSites.set(true);
    this.pageError.set('');
    this.bookingService
      .listSites$()
      .pipe(
        catchError((error) => {
          this.loadingSites.set(false);
          this.pageError.set(this.toUserMessage(error, 'No fue posible cargar las sedes publicas.'));
          return of([]);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((sites) => {
        this.loadingSites.set(false);
        this.sites.set(sites);
        const firstSiteId = this.bookingForm.controls.siteId.value || sites[0]?.id || '';
        this.bookingForm.controls.siteId.setValue(firstSiteId);
        this.selectedSiteId.set(firstSiteId);

        if (!firstSiteId) {
          this.services.set([]);
          this.availabilitySlots.set([]);
        }
      });
  }

  private loadRecentBookings(): void {
    this.bookingService
      .recentBookings$()
      .pipe(
        catchError(() => of([])),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((bookings) => {
        this.recentBookings.set(bookings);
      });
  }

  private loadServices(siteId: string): void {
    if (!siteId) {
      this.services.set([]);
      this.availabilitySlots.set([]);
      this.bookingQuote.set(null);
      return;
    }

    this.loadingServices.set(true);
    this.pageError.set('');
    this.bookingService
      .listServices$(siteId)
      .pipe(
        catchError((error) => {
          this.loadingServices.set(false);
          this.services.set([]);
          this.availabilitySlots.set([]);
          this.pageError.set(this.toUserMessage(error, 'No fue posible cargar el catalogo de servicios.'));
          return of([]);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((services) => {
        this.loadingServices.set(false);
        this.services.set(services);
        const nextServiceId = this.bookingForm.controls.serviceId.value || services[0]?.id || '';
        this.bookingForm.controls.serviceId.setValue(nextServiceId);
        this.selectedServiceId.set(nextServiceId);
        this.loadAvailability();
      });
  }

  private loadAvailability(): void {
    const siteId = this.bookingForm.controls.siteId.value;
    const serviceId = this.bookingForm.controls.serviceId.value;
    if (!siteId || !serviceId) {
      this.availabilitySlots.set([]);
      return;
    }

    this.loadingAvailability.set(true);
    this.bookingQuote.set(null);
    this.pageError.set('');
    this.bookingService
      .availability$(siteId, serviceId)
      .pipe(
        catchError((error) => {
          this.loadingAvailability.set(false);
          this.pageError.set(this.toUserMessage(error, 'No fue posible consultar la disponibilidad.'));
          return of({ siteId, serviceId, slots: [] });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((availability) => {
        this.loadingAvailability.set(false);
        this.availabilitySlots.set(availability.slots);
        if (!availability.slots.some((slot) => slot.startAt === this.bookingForm.controls.slotStartAt.value)) {
          this.bookingForm.controls.slotStartAt.setValue(availability.slots[0]?.startAt ?? '');
        }
      });
  }

  private loadQuote(): void {
    const siteId = this.bookingForm.controls.siteId.value;
    const serviceId = this.bookingForm.controls.serviceId.value;
    const slotStartAt = this.bookingForm.controls.slotStartAt.value;
    if (!siteId || !serviceId || !slotStartAt) {
      this.bookingQuote.set(null);
      this.loadingQuote.set(false);
      return;
    }

    this.loadingQuote.set(true);
    this.pageError.set('');
    this.bookingService
      .quoteBooking$({ siteId, serviceId, slotStartAt })
      .pipe(
        catchError((error) => {
          this.loadingQuote.set(false);
          this.pageError.set(this.toUserMessage(error, 'No fue posible cotizar la reserva seleccionada.'));
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((quote) => {
        this.loadingQuote.set(false);
        this.bookingQuote.set(quote);
      });
  }

  private patchReservationPayment(payment: PublicPaymentVm): void {
    const booking = this.reservationSuccess();
    if (!booking) {
      return;
    }

    this.reservationSuccess.set({
      ...booking,
      payment
    });
  }

  private clearFlowMessages(): void {
    this.bookingQuote.set(null);
    this.reservationSuccess.set(null);
    this.pageError.set('');
  }

  private toUserMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const detail = this.extractBackendMessage(error.error);
      return detail ? `${fallback} ${detail}` : fallback;
    }

    return fallback;
  }

  private extractBackendMessage(payload: unknown): string {
    if (typeof payload === 'string' && payload.trim()) {
      return payload.trim();
    }

    if (typeof payload === 'object' && payload !== null) {
      const message = (payload as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) {
        return message.trim();
      }

      const error = (payload as { error?: unknown }).error;
      if (typeof error === 'string' && error.trim()) {
        return error.trim();
      }
    }

    return '';
  }
}
