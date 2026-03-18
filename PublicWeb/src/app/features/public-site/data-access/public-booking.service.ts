import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface PublicSiteVm {
  id: string;
  organizationId: string;
  name: string;
  timezone: string;
  status: string;
}

export interface PublicServiceVm {
  id: string;
  category: string;
  title: string;
  description: string;
  durationMinutes: number;
  basePrice: number;
  promoPrice?: number;
  badge?: string;
  features: string[];
  priceToPay: number;
}

export interface PublicAvailabilitySlotVm {
  startAt: string;
  endAt: string;
  professionalId: string;
  professionalName: string;
}

export interface PublicAvailabilityVm {
  siteId: string;
  serviceId: string;
  slots: PublicAvailabilitySlotVm[];
}

export interface PublicBookingQuoteVm {
  siteId: string;
  siteName: string;
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  slotStartAt: string;
  slotEndAt: string;
  professionalId: string;
  professionalName: string;
  basePrice: number;
  promoPrice?: number;
  quotedPrice: number;
  currency: string;
  timezone: string;
  holdMinutes: number;
  nextStatus: string;
}

export interface PublicPaymentVm {
  id: string;
  providerKey: string;
  providerReference: string;
  amount: number;
  currency: string;
  status: string;
  providerStatus: string;
  checkoutUrl: string | null;
  clientSecret: string | null;
  failureReason: string | null;
  expiresAt: string | null;
  confirmationPath: string;
}

export interface PublicBookingVm {
  id: string;
  siteId: string;
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  notes: string;
  quotedPrice: number;
  appointmentStartAt: string;
  appointmentEndAt: string;
  status: string;
  expiresAt: string | null;
  appointmentId: string | null;
  professionalId: string | null;
  timezone: string;
  payment: PublicPaymentVm | null;
}

export interface PublicNotificationVm {
  id: string;
  channel: string;
  recipient: string;
  templateCode: string;
  templatePayload: string;
  status: string;
  attemptCount: number;
  providerMessageId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string | null;
}

export interface CreatePublicBookingDto {
  siteId: string;
  serviceId: string;
  slotStartAt: string;
  patientName: string;
  email: string;
  phone: string;
  notes: string;
  idempotencyKey?: string;
}

export interface CreatePublicBookingQuoteDto {
  siteId: string;
  serviceId: string;
  slotStartAt: string;
}

export interface CreatePublicPaymentIntentDto {
  providerKey?: string;
  idempotencyKey?: string;
}

export interface PublicPaymentWebhookDto {
  bookingId?: string;
  providerKey?: string;
  providerReference?: string;
  status: string;
  eventId?: string;
  idempotencyKey?: string;
}

@Injectable({ providedIn: 'root' })
export class PublicBookingService {
  private readonly publicBaseUrl = `${API_BASE_URL}/public`;
  private readonly recentStorageKey = 'cop_public_booking_ids';
  private readonly recentBookingIds$ = new BehaviorSubject<string[]>(this.readRecentBookingIds());

  constructor(private readonly http: HttpClient) {}

  listSites$(): Observable<PublicSiteVm[]> {
    return this.http.get<unknown>(`${this.publicBaseUrl}/sites`).pipe(
      map((raw) => this.toArray(raw).map((entry) => this.mapSite(entry)))
    );
  }

  listServices$(siteId?: string): Observable<PublicServiceVm[]> {
    const url = siteId ? `${this.publicBaseUrl}/catalog?siteId=${encodeURIComponent(siteId)}` : `${this.publicBaseUrl}/catalog`;
    return this.http.get<unknown>(url).pipe(
      map((raw) => this.toArray(raw).map((entry) => this.mapService(entry)))
    );
  }

  availability$(siteId: string, serviceId: string, fromDate?: string): Observable<PublicAvailabilityVm> {
    const params = new URLSearchParams({ siteId, serviceId });
    if (fromDate) {
      params.set('fromDate', fromDate);
    }
    return this.http.get<unknown>(`${this.publicBaseUrl}/availability?${params.toString()}`).pipe(
      map((raw) => this.mapAvailability(this.toObject(raw)))
    );
  }

  quoteBooking$(payload: CreatePublicBookingQuoteDto): Observable<PublicBookingQuoteVm> {
    return this.http.post<unknown>(`${this.publicBaseUrl}/bookings/quote`, payload).pipe(
      map((raw) => this.mapQuote(this.toObject(raw)))
    );
  }

  createBooking$(payload: CreatePublicBookingDto): Observable<PublicBookingVm> {
    return this.http.post<unknown>(`${this.publicBaseUrl}/bookings`, payload).pipe(
      map((raw) => this.mapBooking(this.toObject(raw))),
      map((booking) => {
        this.rememberBookingId(booking.id);
        return booking;
      })
    );
  }

  getBooking$(bookingId: string): Observable<PublicBookingVm> {
    return this.http.get<unknown>(`${this.publicBaseUrl}/bookings/${bookingId}`).pipe(
      map((raw) => this.mapBooking(this.toObject(raw)))
    );
  }

  getBookingNotifications$(bookingId: string): Observable<PublicNotificationVm[]> {
    return this.http.get<unknown>(`${this.publicBaseUrl}/bookings/${bookingId}/notifications`).pipe(
      map((raw) => this.toArray(raw).map((entry) => this.mapNotification(entry)))
    );
  }

  createPaymentIntent$(bookingId: string, payload: CreatePublicPaymentIntentDto = {}): Observable<PublicPaymentVm> {
    return this.http.post<unknown>(`${this.publicBaseUrl}/bookings/${bookingId}/payments/intents`, payload).pipe(
      map((raw) => this.mapPayment(this.toObject(raw)))
    );
  }

  completePayment$(bookingId: string): Observable<PublicBookingVm> {
    return this.http.post<unknown>(`${this.publicBaseUrl}/bookings/${bookingId}/payments/complete`, { status: 'PAID' }).pipe(
      map((raw) => this.mapBooking(this.toObject(raw))),
      map((booking) => {
        this.rememberBookingId(booking.id);
        return booking;
      })
    );
  }

  handlePaymentWebhook$(payload: PublicPaymentWebhookDto): Observable<PublicBookingVm> {
    return this.http.post<unknown>(`${this.publicBaseUrl}/payments/webhook`, payload).pipe(
      map((raw) => this.mapBooking(this.toObject(raw))),
      map((booking) => {
        this.rememberBookingId(booking.id);
        return booking;
      })
    );
  }

  recentBookings$(): Observable<PublicBookingVm[]> {
    return this.recentBookingIds$.pipe(
      switchMap((bookingIds) => {
        if (bookingIds.length === 0) {
          return of([]);
        }

        return forkJoin(
          bookingIds.map((bookingId) =>
            this.getBooking$(bookingId).pipe(
              catchError(() => of(null))
            )
          ),
        ).pipe(
          map((bookings) => bookings.filter((booking): booking is PublicBookingVm => booking !== null))
        );
      })
    );
  }

  private rememberBookingId(bookingId: string): void {
    const next = [bookingId, ...this.recentBookingIds$.value.filter((id) => id !== bookingId)].slice(0, 12);
    this.recentBookingIds$.next(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.recentStorageKey, JSON.stringify(next));
    }
  }

  private readRecentBookingIds(): string[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const raw = localStorage.getItem(this.recentStorageKey);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }

  private mapSite(entry: Record<string, unknown>): PublicSiteVm {
    return {
      id: String(entry['id'] ?? ''),
      organizationId: String(entry['organizationId'] ?? entry['organization_id'] ?? ''),
      name: String(entry['name'] ?? 'Sede'),
      timezone: String(entry['timezone'] ?? 'UTC'),
      status: String(entry['status'] ?? 'ACTIVE')
    };
  }

  private mapService(entry: Record<string, unknown>): PublicServiceVm {
    return {
      id: String(entry['id'] ?? ''),
      category: String(entry['category'] ?? 'General'),
      title: String(entry['title'] ?? 'Servicio'),
      description: String(entry['description'] ?? ''),
      durationMinutes: Number(entry['durationMinutes'] ?? 0),
      basePrice: Number(entry['basePrice'] ?? 0),
      promoPrice: typeof entry['promoPrice'] === 'number' ? entry['promoPrice'] : undefined,
      badge: typeof entry['badge'] === 'string' ? entry['badge'] : undefined,
      features: Array.isArray(entry['features']) ? entry['features'].map((value) => String(value)) : [],
      priceToPay: Number(entry['priceToPay'] ?? entry['promoPrice'] ?? entry['basePrice'] ?? 0)
    };
  }

  private mapAvailability(entry: Record<string, unknown>): PublicAvailabilityVm {
    const rawSlots = Array.isArray(entry['slots']) ? entry['slots'] : [];
    return {
      siteId: String(entry['siteId'] ?? ''),
      serviceId: String(entry['serviceId'] ?? ''),
      slots: rawSlots
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((slot) => ({
          startAt: String(slot['startAt'] ?? ''),
          endAt: String(slot['endAt'] ?? ''),
          professionalId: String(slot['professionalId'] ?? ''),
          professionalName: String(slot['professionalName'] ?? 'Profesional')
        }))
    };
  }

  private mapQuote(entry: Record<string, unknown>): PublicBookingQuoteVm {
    return {
      siteId: String(entry['siteId'] ?? ''),
      siteName: String(entry['siteName'] ?? 'Sede'),
      serviceId: String(entry['serviceId'] ?? ''),
      serviceName: String(entry['serviceName'] ?? 'Servicio'),
      serviceCategory: String(entry['serviceCategory'] ?? 'General'),
      slotStartAt: String(entry['slotStartAt'] ?? ''),
      slotEndAt: String(entry['slotEndAt'] ?? ''),
      professionalId: String(entry['professionalId'] ?? ''),
      professionalName: String(entry['professionalName'] ?? 'Profesional'),
      basePrice: Number(entry['basePrice'] ?? 0),
      promoPrice: typeof entry['promoPrice'] === 'number' ? entry['promoPrice'] : undefined,
      quotedPrice: Number(entry['quotedPrice'] ?? 0),
      currency: String(entry['currency'] ?? 'COP'),
      timezone: String(entry['timezone'] ?? 'UTC'),
      holdMinutes: Number(entry['holdMinutes'] ?? 0),
      nextStatus: String(entry['nextStatus'] ?? 'PENDING_PAYMENT')
    };
  }

  private mapPayment(entry: Record<string, unknown>): PublicPaymentVm {
    return {
      id: String(entry['id'] ?? ''),
      providerKey: String(entry['providerKey'] ?? 'SANDBOX'),
      providerReference: String(entry['providerReference'] ?? ''),
      amount: Number(entry['amount'] ?? 0),
      currency: String(entry['currency'] ?? 'COP'),
      status: String(entry['status'] ?? 'PENDING'),
      providerStatus: String(entry['providerStatus'] ?? entry['status'] ?? 'PENDING'),
      checkoutUrl: entry['checkoutUrl'] ? String(entry['checkoutUrl']) : null,
      clientSecret: entry['clientSecret'] ? String(entry['clientSecret']) : null,
      failureReason: entry['failureReason'] ? String(entry['failureReason']) : null,
      expiresAt: entry['expiresAt'] ? String(entry['expiresAt']) : null,
      confirmationPath: String(entry['confirmationPath'] ?? '')
    };
  }

  private mapBooking(entry: Record<string, unknown>): PublicBookingVm {
    return {
      id: String(entry['id'] ?? ''),
      siteId: String(entry['siteId'] ?? ''),
      serviceId: String(entry['serviceId'] ?? ''),
      serviceName: String(entry['serviceName'] ?? 'Reserva'),
      serviceCategory: String(entry['serviceCategory'] ?? 'General'),
      patientName: String(entry['patientName'] ?? ''),
      patientEmail: String(entry['patientEmail'] ?? ''),
      patientPhone: String(entry['patientPhone'] ?? ''),
      notes: String(entry['notes'] ?? ''),
      quotedPrice: Number(entry['quotedPrice'] ?? 0),
      appointmentStartAt: String(entry['appointmentStartAt'] ?? ''),
      appointmentEndAt: String(entry['appointmentEndAt'] ?? ''),
      status: String(entry['status'] ?? 'PENDING_PAYMENT'),
      expiresAt: entry['expiresAt'] ? String(entry['expiresAt']) : null,
      appointmentId: entry['appointmentId'] ? String(entry['appointmentId']) : null,
      professionalId: entry['professionalId'] ? String(entry['professionalId']) : null,
      timezone: String(entry['timezone'] ?? 'UTC'),
      payment:
        typeof entry['payment'] === 'object' && entry['payment'] !== null
          ? this.mapPayment(entry['payment'] as Record<string, unknown>)
          : null
    };
  }

  private mapNotification(entry: Record<string, unknown>): PublicNotificationVm {
    return {
      id: String(entry['id'] ?? ''),
      channel: String(entry['channel'] ?? ''),
      recipient: String(entry['recipient'] ?? ''),
      templateCode: String(entry['templateCode'] ?? ''),
      templatePayload: String(entry['templatePayload'] ?? ''),
      status: String(entry['status'] ?? 'PENDING'),
      attemptCount: Number(entry['attemptCount'] ?? 0),
      providerMessageId: entry['providerMessageId'] ? String(entry['providerMessageId']) : null,
      errorMessage: entry['errorMessage'] ? String(entry['errorMessage']) : null,
      sentAt: entry['sentAt'] ? String(entry['sentAt']) : null,
      createdAt: entry['createdAt'] ? String(entry['createdAt']) : null
    };
  }

  private toArray(raw: unknown): Record<string, unknown>[] {
    if (Array.isArray(raw)) {
      return raw.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
    }
    if (typeof raw === 'object' && raw !== null && Array.isArray((raw as { data?: unknown }).data)) {
      return (raw as { data: Record<string, unknown>[] }).data;
    }
    return [];
  }

  private toObject(raw: unknown): Record<string, unknown> {
    return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  }
}
