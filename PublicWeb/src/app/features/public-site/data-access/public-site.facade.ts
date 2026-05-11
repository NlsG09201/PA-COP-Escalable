import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import type { MeResponse } from '../../../core/auth/auth.models';
import {
  CreatePublicPaymentIntentDto,
  PublicAvailabilitySlotVm,
  PublicBookingQuoteVm,
  PublicBookingService,
  PublicBookingVm,
  PublicCheckoutContextVm,
  PublicPaymentMethodVm,
  PublicPaymentVm,
  PublicServiceVm,
  PublicSiteVm,
  WompiPresetsVm,
} from './public-booking.service';

@Injectable()
export class PublicSiteFacade {
  private readonly bookingService = inject(PublicBookingService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

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

  readonly checkoutMethods = signal<PublicPaymentMethodVm[]>([]);
  readonly checkoutContext = signal<PublicCheckoutContextVm | null>(null);
  readonly selectedProviderKey = signal('SANDBOX');
  readonly walletPhone = signal('');
  readonly pseLegalId = signal('');
  readonly cardPaymentToken = signal('');
  readonly wompiPresets = signal<WompiPresetsVm | null>(null);
  readonly wompiTermsAccepted = signal(false);
  readonly loadingWompiPresets = signal(false);

  readonly needsWalletPhone = computed(() => ['NEQUI', 'DAVIPLATA'].includes(this.selectedProviderKey()));
  readonly needsPse = computed(() => this.selectedProviderKey().startsWith('PSE_'));
  readonly needsCard = computed(() => this.selectedProviderKey() === 'CARD_TOKEN');

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

    forkJoin({
      methods: this.bookingService.listCheckoutMethods$(),
      context: this.bookingService.checkoutContext$(),
    })
      .pipe(
        catchError(() =>
          of({
            methods: { methods: [] as PublicPaymentMethodVm[] },
            context: null as PublicCheckoutContextVm | null,
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ methods, context }) => {
        this.checkoutMethods.set(methods.methods ?? []);
        this.checkoutContext.set(context);
      });
  }

  onCheckoutProviderChange(key: string): void {
    this.selectedProviderKey.set(key);
    this.wompiTermsAccepted.set(false);
    this.wompiPresets.set(null);
  }

  loadWompiPresets(): void {
    this.loadingWompiPresets.set(true);
    this.pageError.set('');
    this.bookingService
      .wompiPresets$()
      .pipe(
        catchError((error) => {
          this.pageError.set(this.toUserMessage(error, 'No se pudieron cargar los contratos Wompi.'));
          return of(null);
        }),
        finalize(() => this.loadingWompiPresets.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((p) => {
        if (p) this.wompiPresets.set(p);
      });
  }

  toggleWompiTerms(accepted: boolean): void {
    this.wompiTermsAccepted.set(accepted);
  }

  setWalletPhone(v: string): void {
    this.walletPhone.set(v);
  }

  setPseLegalId(v: string): void {
    this.pseLegalId.set(v);
  }

  setCardToken(v: string): void {
    this.cardPaymentToken.set(v);
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
        if (booking.payment?.checkoutUrl) {
          this.openCheckoutUrl(booking.payment.checkoutUrl);
          return;
        }
        this.prepareCheckout(booking);
      });
  }

  prepareCheckout(sourceBooking?: PublicBookingVm): void {
    const booking = sourceBooking ?? this.reservationSuccess();
    if (!booking || booking.status === 'EXPIRED') {
      return;
    }

    const ctx = this.checkoutContext();
    const pk = this.selectedProviderKey();

    if (ctx?.wompiConfigured && pk !== 'SANDBOX') {
      if (!this.wompiPresets()) {
        this.pageError.set('Pulse "Cargar contratos del pasarela (Wompi)" antes de preparar el pago.');
        return;
      }
      if (!this.wompiTermsAccepted()) {
        this.pageError.set('Debe aceptar los contratos del proveedor de pagos.');
        return;
      }
      if (this.needsWalletPhone() && !this.walletPhone().trim()) {
        this.pageError.set('Indique el celular asociado a Nequi o Daviplata.');
        return;
      }
      if (this.needsPse() && !this.pseLegalId().trim()) {
        this.pageError.set('Indique el documento del pagador para PSE.');
        return;
      }
      if (this.needsCard() && !this.cardPaymentToken().trim()) {
        this.pageError.set(
          'Para tarjeta use el token generado por el widget Wompi (no ingrese PAN/CVC manualmente en produccion).',
        );
        return;
      }
    }

    this.preparingCheckout.set(true);
    this.pageError.set('');

    const payload: CreatePublicPaymentIntentDto = {
      idempotencyKey: crypto.randomUUID(),
      providerKey: pk,
    };
    const wph = this.walletPhone().replace(/\D/g, '');
    if (wph) payload.walletPhone = wph;
    const doc = this.pseLegalId().trim();
    if (doc) {
      payload.pseLegalId = doc;
      payload.pseLegalIdType = 'CC';
    }
    const ctk = this.cardPaymentToken().trim();
    if (ctk) payload.cardPaymentSourceToken = ctk;
    if (ctx?.wompiConfigured && pk !== 'SANDBOX' && this.wompiPresets()) {
      const w = this.wompiPresets()!;
      payload.wompiAcceptanceToken = w.acceptanceToken;
      payload.wompiPersonalAuth = w.acceptPersonalAuth;
    }

    this.bookingService
      .createPaymentIntent$(booking.id, payload)
      .pipe(
        catchError((error) => {
          this.preparingCheckout.set(false);
          this.pageError.set(this.toUserMessage(error, 'No fue posible preparar el checkout.'));
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((payment) => {
        this.preparingCheckout.set(false);
        if (!payment) {
          return;
        }

        this.patchReservationPayment(payment);
        if (payment.checkoutUrl) {
          this.openCheckoutUrl(payment.checkoutUrl);
        }
      });
  }

  completePayment(): void {
    const booking = this.reservationSuccess();
    if (!booking) {
      return;
    }

    if (booking.payment?.checkoutUrl) {
      this.processingPayment.set(true);
      this.openCheckoutUrl(booking.payment.checkoutUrl);
      return;
    }

    this.pageError.set('Primero debes preparar el checkout de la reserva.');
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

        if (this.auth.isLoggedIn()) {
          this.auth
            .loadMe$()
            .pipe(
              catchError(() => of(null)),
              takeUntilDestroyed(this.destroyRef),
            )
            .subscribe((me) => {
              if (me) this.patchBookingFromProfile(me);
            });
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
    this.wompiPresets.set(null);
    this.wompiTermsAccepted.set(false);
    this.selectedProviderKey.set('SANDBOX');
    this.walletPhone.set('');
    this.pseLegalId.set('');
    this.cardPaymentToken.set('');
  }

  /** Si hay sesión, usa datos del paciente solo donde los controles siguen vacíos. */
  private patchBookingFromProfile(me: MeResponse): void {
    const sites = this.sites();
    const jwtSite = String(me.site_id ?? '').trim();

    const profile = me.profile;
    const emailFromProfile = String(profile?.email ?? me.username ?? '').trim();

    const patchText = (
      control: typeof this.bookingForm.controls.patientName,
      value?: string | null,
    ): void => {
      const next = String(value ?? '').trim();
      if (!next) return;
      const cur = String(control.value ?? '').trim();
      if (!cur) control.setValue(next);
    };

    patchText(this.bookingForm.controls.patientName, profile?.fullName);
    patchText(this.bookingForm.controls.email, emailFromProfile || null);
    patchText(this.bookingForm.controls.phone, profile?.phone);

    if (jwtSite && sites.some((s) => s.id === jwtSite)) {
      this.bookingForm.controls.siteId.setValue(jwtSite);
    }
  }

  private openCheckoutUrl(checkoutUrl: string): void {
    this.document.defaultView?.setTimeout(() => this.processingPayment.set(false), 1500);
    this.document.defaultView?.location.assign(checkoutUrl);
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
