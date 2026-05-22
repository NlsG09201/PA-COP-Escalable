import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { UUID } from 'bson';
import * as crypto from 'crypto';
import { Connection } from 'mongoose';
import { BookingNotificationsService } from '../notifications/booking-notifications.service';
import { idVariants } from '../tenancy/tenant-query.util';
import { ColombianPaymentGatewayService } from './payments/colombian-payment-gateway.service';
import {
  extractWompiTransaction,
  mapWompiTransactionToInternalStatus,
  verifyWompiEventChecksum,
} from './payments/wompi-webhook.util';

function asUuid(value?: string): UUID | undefined {
  if (!value) return undefined;
  try {
    return new UUID(String(value));
  } catch {
    return undefined;
  }
}

function asStringId(value: any): string {
  if (!value) return '';
  try {
    return typeof value === 'string' ? value : value.toString();
  } catch {
    return String(value);
  }
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

type PublicBillingMode = 'FULL' | 'INSTALLMENTS' | 'QUOTE_CONSULT';

function normalizeBillingMode(v?: string): PublicBillingMode {
  const x = String(v ?? 'FULL').toUpperCase().trim();
  if (x === 'INSTALLMENTS' || x === 'QUOTE_CONSULT') return x;
  return 'FULL';
}

@Injectable()
export class PublicSiteService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly colombianPayments: ColombianPaymentGatewayService,
    private readonly bookingNotificationsSvc: BookingNotificationsService,
  ) {}

  /** Sedes en Atlas pueden tener `_id` como string (Mongoose) o BSON UUID (seed nativo). */
  private async findSiteDoc(siteId: string): Promise<any | null> {
    return this.connection.collection<any>('sites').findOne({ _id: { $in: idVariants(siteId) } } as any);
  }

  private async requireSite(siteId?: string): Promise<any> {
    const id = String(siteId ?? '').trim();
    if (!id) throw new BadRequestException('siteId is required');
    if (!asUuid(id)) throw new BadRequestException('siteId must be a valid UUID');
    const site = await this.findSiteDoc(id);
    if (!site) throw new BadRequestException('siteId not found');
    return site;
  }

  private async findOfferingForSite(site: any, serviceId: string): Promise<any | null> {
    return this.connection.collection<any>('service_offerings').findOne({
      _id: { $in: idVariants(serviceId) },
      site_id: { $in: idVariants(asStringId(site._id)) },
    } as any);
  }

  private async findOrCreatePatient(input: {
    organizationId: any;
    siteId: any;
    fullName: string;
    email?: string;
    phone?: string;
    documentType?: string;
    documentNumber?: string;
  }): Promise<{ _id: UUID }> {
    const email = String(input.email ?? '').trim().toLowerCase();
    const phone = String(input.phone ?? '').trim();
    const documentType = String(input.documentType ?? '').trim().toUpperCase();
    const documentNumber = String(input.documentNumber ?? '').trim();

    const match: any = { organization_id: input.organizationId };
    if (input.siteId) match.site_id = input.siteId;

    const byDoc =
      documentNumber.length >= 4
        ? await this.connection.collection<any>('patients').findOne({
            ...match,
            document_number: documentNumber,
          } as any)
        : null;

    const patient =
      byDoc ??
      (email ? await this.connection.collection<any>('patients').findOne({ ...match, email } as any) : null) ??
      (phone ? await this.connection.collection<any>('patients').findOne({ ...match, phone } as any) : null);

    if (patient?._id) {
      await this.connection.collection<any>('patients').updateOne(
        { _id: patient._id } as any,
        {
          $set: {
            full_name: String(input.fullName ?? patient.full_name ?? '').trim() || patient.full_name,
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
            ...(documentType ? { document_type: documentType } : {}),
            ...(documentNumber ? { document_number: documentNumber } : {}),
            updated_at: new Date(),
          },
        },
      );
      return { _id: patient._id as UUID };
    }

    const patientId = new UUID(crypto.randomUUID());
    await this.connection.collection<any>('patients').insertOne({
      _id: patientId,
      organization_id: input.organizationId,
      site_id: input.siteId,
      external_code: null,
      full_name: String(input.fullName ?? '').trim(),
      birth_date: null,
      gender: null,
      phone: phone || null,
      email: email || null,
      document_type: documentType || null,
      document_number: documentNumber || null,
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
    });

    return { _id: patientId };
  }

  async availability(input: { siteId: string; serviceId: string; fromDate?: string }) {
    if (!input.serviceId) throw new BadRequestException('serviceId is required');
    if (!asUuid(input.serviceId)) throw new BadRequestException('serviceId must be a valid UUID');

    const site = await this.requireSite(input.siteId);
    const offering = await this.findOfferingForSite(site, input.serviceId);
    if (!offering) throw new BadRequestException('serviceId not found');

    const catalog = offering.catalog_service_id
      ? await this.connection.collection<any>('catalog_services').findOne({ _id: { $in: idVariants(asStringId(offering.catalog_service_id)) } } as any)
      : null;

    const durationMinutes = Number(catalog?.default_duration_minutes ?? 45);

    const orgProfessionals = await this.connection
      .collection<any>('professionals')
      .find({ organization_id: site.organization_id, status: 'ACTIVE' } as any, { projection: { _id: 1, full_name: 1, default_site_id: 1 } })
      .toArray();

    const professionals = orgProfessionals
      .filter((p: any) => !p.default_site_id || asStringId(p.default_site_id) === asStringId(site._id))
      .slice(0, 10);

    if (professionals.length === 0) {
      return { siteId: input.siteId, serviceId: input.serviceId, slots: [] };
    }

    const baseDate = input.fromDate ? new Date(`${input.fromDate}T00:00:00.000Z`) : new Date();
    if (Number.isNaN(baseDate.getTime())) throw new BadRequestException('fromDate must be YYYY-MM-DD');

    // Basic timezone support for Bogotá; fallback UTC.
    const tz = String(site.timezone ?? 'UTC');
    const offsetHours = tz.includes('Bogota') ? -5 : 0;

    const days = 5;
    const slots: Array<{ startAt: string; endAt: string; professionalId: string; professionalName: string }> = [];

    const rangeStartUtc = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 0, 0, 0));
    const rangeEndUtc = new Date(rangeStartUtc.getTime() + days * 24 * 60 * 60_000);

    const busyAll = await this.connection
      .collection<any>('appointments')
      .find(
        {
          site_id: site._id,
          start_at: { $lt: rangeEndUtc },
          end_at: { $gt: rangeStartUtc },
          status: { $in: ['REQUESTED', 'CONFIRMED', 'COMPLETED'] },
        } as any,
        { projection: { professional_id: 1, start_at: 1, end_at: 1 } },
      )
      .toArray();

    const busyByProf = new Map<string, Array<{ start: Date; end: Date }>>();
    for (const b of busyAll) {
      const key = b.professional_id ? asStringId(b.professional_id) : '';
      if (!key) continue;
      const list = busyByProf.get(key) ?? [];
      list.push({ start: new Date(b.start_at), end: new Date(b.end_at) });
      busyByProf.set(key, list);
    }

    for (let d = 0; d < days; d++) {
      // Create local day 09:00-17:00 then shift to UTC using offset.
      const dayUtc = new Date(rangeStartUtc.getTime() + d * 24 * 60 * 60_000);
      const localYear = dayUtc.getUTCFullYear();
      const localMonth = dayUtc.getUTCMonth();
      const localDay = dayUtc.getUTCDate();

      const localStart = new Date(Date.UTC(localYear, localMonth, localDay, 9 - offsetHours, 0, 0));
      const localEnd = new Date(Date.UTC(localYear, localMonth, localDay, 17 - offsetHours, 0, 0));

      for (let t = localStart.getTime(); t + durationMinutes * 60_000 <= localEnd.getTime(); t += durationMinutes * 60_000) {
        const startAt = new Date(t);
        const endAt = new Date(t + durationMinutes * 60_000);

        const siteBlocked = busyAll.some((b) =>
          rangesOverlap(startAt, endAt, new Date(b.start_at), new Date(b.end_at)),
        );
        if (siteBlocked) continue;

        let anyProfFree = false;
        for (const p of professionals) {
          const pid = asStringId(p._id);
          const ranges = busyByProf.get(pid) ?? [];
          const overlapsProf = ranges.some((r) => rangesOverlap(startAt, endAt, r.start, r.end));
          if (!overlapsProf) {
            anyProfFree = true;
            break;
          }
        }
        if (!anyProfFree) continue;

        slots.push({
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          professionalId: '',
          professionalName: '',
        });
      }
    }

    // Limit to keep UI fast.
    return { siteId: input.siteId, serviceId: input.serviceId, slots: slots.slice(0, 200) };
  }

  async quoteBooking(input: {
    siteId?: string;
    serviceId?: string;
    slotStartAt?: string;
    billingMode?: string;
    installmentCount?: number;
  }) {
    if (!input.serviceId) throw new BadRequestException('serviceId is required');
    if (!input.slotStartAt) throw new BadRequestException('slotStartAt is required');
    if (!asUuid(input.serviceId)) throw new BadRequestException('serviceId must be a valid UUID');

    const startAt = new Date(input.slotStartAt);
    if (Number.isNaN(startAt.getTime())) throw new BadRequestException('slotStartAt must be a valid ISO date');

    const site = await this.requireSite(input.siteId);
    const offering = await this.findOfferingForSite(site, input.serviceId);
    if (!offering) throw new BadRequestException('serviceId not found');

    const catalogItem = offering.catalog_service_id
      ? await this.connection.collection<any>('catalog_services').findOne({ _id: { $in: idVariants(asStringId(offering.catalog_service_id)) } } as any)
      : null;

    const category = catalogItem?.category_id
      ? await this.connection.collection<any>('service_categories').findOne({ _id: { $in: idVariants(asStringId(catalogItem.category_id)) } } as any)
      : null;

    const durationMinutes = Number(catalogItem?.default_duration_minutes ?? 45);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

    const basePrice = Number(offering.base_price ?? 0);
    const promoPrice = undefined;
    const billingMode = normalizeBillingMode(input.billingMode);
    const installmentCount =
      billingMode === 'INSTALLMENTS' ? Math.max(2, Math.min(36, Number(input.installmentCount ?? 6))) : 1;

    let quotedPrice = basePrice;
    let totalTreatmentPrice = basePrice;
    if (billingMode === 'INSTALLMENTS') {
      quotedPrice = basePrice > 0 ? Math.max(1, Math.ceil(basePrice / installmentCount)) : 0;
    } else if (billingMode === 'QUOTE_CONSULT') {
      const pct = Math.ceil(basePrice * 0.15);
      quotedPrice = basePrice > 0 ? Math.max(20_000, Math.min(120_000, pct)) : 30_000;
      totalTreatmentPrice = basePrice;
    }

    const availability = await this.availability({ siteId: asStringId(site._id), serviceId: asStringId(offering._id), fromDate: startAt.toISOString().slice(0, 10) });
    const matchSlot = availability.slots.find((s) => s.startAt === startAt.toISOString());
    if (!matchSlot) throw new BadRequestException('Horario no disponible');

    return {
      siteId: asStringId(site._id),
      siteName: String(site.name ?? 'Sede'),
      serviceId: asStringId(offering._id),
      serviceName: String(offering.public_title ?? catalogItem?.name ?? 'Servicio'),
      serviceCategory: String(category?.name ?? 'General'),
      slotStartAt: startAt.toISOString(),
      slotEndAt: endAt.toISOString(),
      professionalId: '',
      professionalName: 'Se asignará desde la clínica',
      basePrice,
      promoPrice,
      quotedPrice,
      totalTreatmentPrice,
      billingMode,
      installmentCount: billingMode === 'INSTALLMENTS' ? installmentCount : 1,
      currency: 'COP',
      timezone: String(site.timezone ?? 'UTC'),
      holdMinutes: 15,
      nextStatus: 'PENDING_PAYMENT',
    };
  }

  async createBooking(input: {
    siteId?: string;
    serviceId?: string;
    slotStartAt?: string;
    patientName?: string;
    email?: string;
    phone?: string;
    notes?: string;
    documentType?: string;
    documentNumber?: string;
    billingMode?: string;
    installmentCount?: number;
    idempotencyKey?: string;
  }) {
    if (!input.serviceId) throw new BadRequestException('serviceId is required');
    if (!input.slotStartAt) throw new BadRequestException('slotStartAt is required');
    if (!asUuid(input.serviceId)) throw new BadRequestException('serviceId must be a valid UUID');

    const docType = String(input.documentType ?? '').trim().toUpperCase();
    const docNum = String(input.documentNumber ?? '').trim();
    if (!docType || docType.length < 2) throw new BadRequestException('documentType is required');
    if (!docNum || docNum.length < 4) throw new BadRequestException('documentNumber is required');

    const startAt = new Date(input.slotStartAt);
    if (Number.isNaN(startAt.getTime())) throw new BadRequestException('slotStartAt must be a valid ISO date');

    const site = await this.requireSite(input.siteId);
    const offering = await this.findOfferingForSite(site, input.serviceId);
    if (!offering) throw new BadRequestException('serviceId not found');

    const catalogItem = offering.catalog_service_id
      ? await this.connection.collection<any>('catalog_services').findOne({ _id: { $in: idVariants(asStringId(offering.catalog_service_id)) } } as any)
      : null;

    const category = catalogItem?.category_id
      ? await this.connection.collection<any>('service_categories').findOne({ _id: { $in: idVariants(asStringId(catalogItem.category_id)) } } as any)
      : null;

    const durationMinutes = Number(catalogItem?.default_duration_minutes ?? 45);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

    const overlap = await this.connection.collection<any>('appointments').findOne({
      site_id: site._id,
      start_at: { $lt: endAt },
      end_at: { $gt: startAt },
      status: { $in: ['REQUESTED', 'CONFIRMED', 'COMPLETED'] },
    } as any);
    if (overlap) throw new BadRequestException('Ese horario ya no esta disponible');

    const bookingId = new UUID(crypto.randomUUID());

    const availability = await this.availability({ siteId: asStringId(site._id), serviceId: asStringId(offering._id), fromDate: startAt.toISOString().slice(0, 10) });
    const selectedSlot = availability.slots.find((s) => s.startAt === startAt.toISOString());
    if (!selectedSlot) throw new BadRequestException('Horario no disponible');

    const billingMode = normalizeBillingMode(input.billingMode);
    const installmentCount =
      billingMode === 'INSTALLMENTS' ? Math.max(2, Math.min(36, Number(input.installmentCount ?? 6))) : 1;
    const basePrice = Number(offering.base_price ?? 0);
    let quotedPrice = basePrice;
    let totalTreatmentPrice = basePrice;
    if (billingMode === 'INSTALLMENTS') {
      quotedPrice = basePrice > 0 ? Math.max(1, Math.ceil(basePrice / installmentCount)) : 0;
    } else if (billingMode === 'QUOTE_CONSULT') {
      const pct = Math.ceil(basePrice * 0.15);
      quotedPrice = basePrice > 0 ? Math.max(20_000, Math.min(120_000, pct)) : 30_000;
    }

    const patient = await this.findOrCreatePatient({
      organizationId: site.organization_id,
      siteId: site._id,
      fullName: String(input.patientName ?? '').trim(),
      email: input.email,
      phone: input.phone,
      documentType: docType,
      documentNumber: docNum,
    });

    const appointmentId = new UUID(crypto.randomUUID());

    await this.connection.collection<any>('appointments').insertOne({
      _id: appointmentId,
      professional_id: null,
      patient_id: patient._id,
      start_at: startAt,
      end_at: endAt,
      status: 'REQUESTED',
      reason: `Reserva publica - ${String(offering.public_title ?? catalogItem?.name ?? '')}`,
      service_offering_id: offering._id,
      service_name_snapshot: String(offering.public_title ?? catalogItem?.name ?? ''),
      service_category_snapshot: String(category?.name ?? 'General'),
      version: 0,
      organization_id: site.organization_id,
      site_id: site._id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const doc: any = {
      _id: bookingId,
      service_id: asStringId(offering._id),
      service_name: String(offering.public_title ?? catalogItem?.name ?? 'Servicio'),
      service_category: String(category?.name ?? 'General'),
      patient_name: String(input.patientName ?? ''),
      patient_email: String(input.email ?? ''),
      patient_phone: String(input.phone ?? ''),
      patient_document_type: docType,
      patient_document_number: docNum,
      notes: input.notes != null ? String(input.notes) : '',
      billing_mode: billingMode,
      installment_count: billingMode === 'INSTALLMENTS' ? installmentCount : 1,
      total_treatment_price: totalTreatmentPrice,
      quoted_price: quotedPrice,
      appointment_start_at: startAt,
      appointment_end_at: endAt,
      status: 'PENDING_PAYMENT',
      professional_id: null,
      patient_id: patient._id,
      appointment_id: appointmentId,
      payment_id: null,
      organization_id: site.organization_id,
      site_id: site._id,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await this.connection.collection<any>('public_bookings').insertOne(doc);
    return this.getBooking({ bookingId: asStringId(bookingId) });
  }

  async listBookingNotificationLogs(input: { bookingId: string }) {
    const bookingUuid = asUuid(input.bookingId);
    if (!bookingUuid) throw new BadRequestException('bookingId must be a valid UUID');

    const logs = await this.connection
      .collection<any>('public_notification_logs')
      .find({ booking_id: bookingUuid as any } as any)
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();

    return logs.map((l: any) => ({
      id: asStringId(l._id),
      channel: String(l.channel ?? ''),
      recipient: String(l.recipient ?? ''),
      templateCode: String(l.template_code ?? ''),
      templatePayload: l.template_payload ? JSON.stringify(l.template_payload) : '',
      status: String(l.status ?? 'PENDING'),
      attemptCount: Number(l.attempt_count ?? 0),
      providerMessageId: l.provider_message_id ? String(l.provider_message_id) : null,
      errorMessage: l.error_message ? String(l.error_message) : null,
      sentAt: l.sent_at ? new Date(l.sent_at).toISOString() : null,
      createdAt: l.created_at ? new Date(l.created_at).toISOString() : null,
    }));
  }

  async createPaymentIntent(input: {
    bookingId: string;
    providerKey?: string;
    idempotencyKey?: string;
    walletPhone?: string;
    pseLegalId?: string;
    pseLegalIdType?: string;
    pseUserType?: 'PERSON' | 'BUSINESS';
    cardPaymentSourceToken?: string;
    wompiAcceptanceToken?: string;
    wompiPersonalAuth?: string;
  }) {
    const bookingUuid = asUuid(input.bookingId);
    if (!bookingUuid) throw new BadRequestException('bookingId must be a valid UUID');

    const booking = await this.connection.collection<any>('public_bookings').findOne({ _id: bookingUuid as any } as any);
    if (!booking) throw new BadRequestException('bookingId not found');

    const providerKey = this.colombianPayments.normalizeProvider(input.providerKey);
    const amountPesos = Number(booking.quoted_price ?? 0);
    const customerEmail = String(booking.patient_email ?? '').trim() || 'paciente@cop.local';

    const resolved = await this.colombianPayments.resolveCheckout({
      bookingId: input.bookingId,
      amountPesos,
      customerEmail,
      providerKey,
      idempotencyKey: input.idempotencyKey,
      walletPhone: input.walletPhone,
      pseLegalId: input.pseLegalId,
      pseLegalIdType: input.pseLegalIdType,
      pseUserType: input.pseUserType,
      cardPaymentSourceToken: input.cardPaymentSourceToken,
      wompiAcceptanceToken: input.wompiAcceptanceToken,
      wompiPersonalAuth: input.wompiPersonalAuth,
    });

    const paymentId = new UUID(crypto.randomUUID());
    const clientSecret = `pay_${crypto.randomUUID()}`;

    const paymentDoc: any = {
      _id: paymentId,
      booking_id: booking._id,
      provider_key: providerKey,
      provider_reference: resolved.providerReference,
      provider_status: 'REQUIRES_ACTION',
      checkout_url: resolved.checkoutUrl,
      client_secret: clientSecret,
      amount: booking.quoted_price ?? 0,
      currency: 'COP',
      status: 'REQUIRES_ACTION',
      idempotency_key: input.idempotencyKey ?? null,
      gateway_external_id: resolved.externalTransactionId ?? null,
      gateway_redirect_hint: resolved.redirectHint ?? null,
      organization_id: booking.organization_id,
      site_id: booking.site_id,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await this.connection.collection<any>('public_payments').insertOne(paymentDoc);
    await this.connection
      .collection<any>('public_bookings')
      .updateOne({ _id: booking._id }, { $set: { payment_id: paymentId, updated_at: new Date() } });

    return {
      id: asStringId(paymentId),
      providerKey,
      providerReference: resolved.providerReference,
      amount: Number(paymentDoc.amount ?? 0),
      currency: 'COP',
      status: 'REQUIRES_ACTION',
      providerStatus: 'REQUIRES_ACTION',
      checkoutUrl: String(paymentDoc.checkout_url ?? null),
      clientSecret,
      failureReason: null,
      expiresAt: null,
      confirmationPath: `/booking/confirmation/${input.bookingId}`,
      gatewayHint: resolved.redirectHint ?? null,
    };
  }

  async completePayment(input: { bookingId: string; status?: string }) {
    const bookingUuid = asUuid(input.bookingId);
    if (!bookingUuid) throw new BadRequestException('bookingId must be a valid UUID');

    const booking = await this.connection.collection<any>('public_bookings').findOne({ _id: bookingUuid as any } as any);
    if (!booking) throw new BadRequestException('bookingId not found');

    if (booking.payment_id) {
      await this.connection.collection<any>('public_payments').updateOne(
        { _id: booking.payment_id },
        { $set: { status: 'PAID', provider_status: 'APPROVED', paid_at: new Date(), updated_at: new Date() } },
      );
    }

    await this.confirmPublicBookingAndAppointment(booking._id, booking.appointment_id);

    return this.getBooking({ bookingId: input.bookingId });
  }

  /**
   * Webhook unificado: payload Wompi (`transaction.updated`) con verificacion de checksum,
   * o formato legacy sandbox `{ bookingId, providerReference, status }`.
   */
  async handlePaymentWebhook(input: Record<string, unknown> | any) {
    const body = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};

    if (extractWompiTransaction(body)) {
      return this.processWompiTransactionWebhook(body);
    }

    return this.processLegacySandboxWebhook(input);
  }

  private async processWompiTransactionWebhook(body: Record<string, unknown>) {
    const eventsSecret = process.env.WOMPI_EVENTS_SECRET?.trim() ?? '';
    const allowUnverified = process.env.WOMPI_SKIP_WEBHOOK_VERIFY === 'true';

    if (!allowUnverified) {
      if (!eventsSecret) {
        throw new UnauthorizedException('Configura WOMPI_EVENTS_SECRET (secreto de eventos en el dashboard Wompi) para validar webhooks');
      }
      if (!verifyWompiEventChecksum(body, eventsSecret)) {
        throw new UnauthorizedException('Checksum de evento Wompi invalido');
      }
    } else if (eventsSecret && !verifyWompiEventChecksum(body, eventsSecret)) {
      throw new UnauthorizedException('Checksum de evento Wompi invalido');
    }

    const tx = extractWompiTransaction(body)!;
    const reference = String(tx['reference'] ?? '');
    const wid = String(tx['id'] ?? '');
    const wStatus = String(tx['status'] ?? '');
    const internal = mapWompiTransactionToInternalStatus(wStatus);
    const dedupeKey = `wompi:tx:${wid}:${wStatus}:${String(body['sent_at'] ?? '')}`;

    const orClauses: any[] = [];
    if (reference) orClauses.push({ provider_reference: reference });
    if (wid) orClauses.push({ gateway_external_id: wid });

    const payment =
      orClauses.length > 0
        ? await this.connection.collection<any>('public_payments').findOne({ $or: orClauses } as any)
        : null;

    if (!payment) {
      return { ok: true, matched: false, reason: 'payment_not_found', reference, transactionId: wid };
    }

    if (payment.last_webhook_idempotency_key === dedupeKey) {
      const bid = payment.booking_id ? asStringId(payment.booking_id) : '';
      return bid ? this.getBooking({ bookingId: bid }) : { ok: true, duplicate: true };
    }

    const failureMsg = (() => {
      const m = tx['status_message'] ?? tx['error_reason'] ?? tx['response_message'];
      if (m == null) return null;
      return typeof m === 'string' ? m : JSON.stringify(m);
    })();

    const statusPatch =
      internal === 'PAID' ? 'PAID' : internal === 'FAILED' ? 'FAILED' : internal === 'REQUIRES_ACTION' ? 'REQUIRES_ACTION' : 'PENDING';

    const paymentPatch: Record<string, unknown> = {
      provider_key: 'WOMPI',
      provider_status: wStatus,
      status: statusPatch,
      last_webhook_idempotency_key: dedupeKey,
      updated_at: new Date(),
      gateway_external_id: wid || payment.gateway_external_id,
    };

    if (internal === 'PAID') {
      paymentPatch.paid_at = new Date();
      paymentPatch.failure_reason = null;
    } else if (internal === 'FAILED') {
      paymentPatch.failure_reason = failureMsg ?? wStatus;
      paymentPatch.paid_at = null;
    }

    await this.connection
      .collection<any>('public_payments')
      .updateOne({ _id: payment._id } as any, { $set: paymentPatch });

    if (internal === 'PAID') {
      await this.confirmPublicBookingAndAppointment(payment.booking_id, undefined);
    } else if (internal === 'FAILED') {
      await this.reopenPublicBookingAfterFailedPayment(payment.booking_id);
    }

    const bookingId = payment.booking_id ? asStringId(payment.booking_id) : '';
    return bookingId ? this.getBooking({ bookingId }) : { ok: true, matched: true };
  }

  private async processLegacySandboxWebhook(input: {
    bookingId?: string;
    providerKey?: string;
    providerReference?: string;
    status: string;
    eventId?: string;
    idempotencyKey?: string;
  }) {
    const bookingUuid = asUuid(input.bookingId);
    if (input.bookingId && !bookingUuid) throw new BadRequestException('bookingId must be a valid UUID');

    const payment = input.providerReference
      ? await this.connection.collection<any>('public_payments').findOne({ provider_reference: String(input.providerReference) } as any)
      : bookingUuid
        ? await this.connection.collection<any>('public_payments').findOne({ booking_id: bookingUuid as any } as any)
        : null;

    if (payment) {
      const st = String(input.status ?? '').toLowerCase().trim();
      const approved = st === 'approved' || st === 'paid';
      const rejected = st === 'failed' || st === 'declined';
      await this.connection.collection<any>('public_payments').updateOne(
        { _id: payment._id },
        {
          $set: {
            provider_key: String(input.providerKey ?? payment.provider_key ?? 'UNKNOWN'),
            provider_status: String(input.status ?? payment.provider_status ?? 'unknown'),
            status: approved ? 'PAID' : rejected ? 'FAILED' : String(payment.status ?? 'PENDING'),
            last_webhook_idempotency_key: input.idempotencyKey ?? input.eventId ?? null,
            updated_at: new Date(),
            ...(approved ? { paid_at: new Date(), failure_reason: null } : {}),
            ...(rejected ? { failure_reason: String(input.status ?? 'FAILED'), paid_at: null } : {}),
          },
        },
      );
    }

    if (bookingUuid) {
      const normalized = String(input.status ?? '').toLowerCase().trim();
      if (normalized === 'approved' || normalized === 'paid') {
        const booking = await this.connection.collection<any>('public_bookings').findOne({ _id: bookingUuid as any } as any);
        if (booking) await this.confirmPublicBookingAndAppointment(booking._id, booking.appointment_id);
      } else if (normalized === 'failed' || normalized === 'declined') {
        await this.reopenPublicBookingAfterFailedPayment(bookingUuid);
      }
      return this.getBooking({ bookingId: input.bookingId! });
    }

    const inferredBookingId = payment?.booking_id ? asStringId(payment.booking_id) : null;
    return inferredBookingId ? this.getBooking({ bookingId: inferredBookingId }) : null;
  }

  private async confirmPublicBookingAndAppointment(bookingId: any, appointmentId?: any) {
    await this.connection
      .collection<any>('public_bookings')
      .updateOne({ _id: bookingId } as any, { $set: { status: 'CONFIRMED', updated_at: new Date() } });

    const booking = await this.connection.collection<any>('public_bookings').findOne({ _id: bookingId } as any);
    const appt = appointmentId ?? booking?.appointment_id;
    if (appt) {
      await this.connection.collection<any>('appointments').updateOne({ _id: appt } as any, { $set: { status: 'CONFIRMED', updated_at: new Date() } });
    }

    const bid = asStringId(bookingId);
    void this.bookingNotificationsSvc.notifyBookingConfirmed(bid).catch(() => undefined);
  }

  private async reopenPublicBookingAfterFailedPayment(bookingId: any) {
    if (!bookingId) return;
    await this.connection.collection<any>('public_bookings').updateOne(
      { _id: bookingId } as any,
      { $set: { status: 'PENDING_PAYMENT', updated_at: new Date() } },
    );
  }

  async listCatalog(input: { siteId?: string }) {
    const siteId = String(input.siteId ?? '').trim();
    if (!siteId) return [];
    if (!asUuid(siteId)) throw new BadRequestException('siteId must be a valid UUID');

    const site = await this.findSiteDoc(siteId);
    if (!site) throw new BadRequestException('siteId not found');

    const offerings = await this.connection
      .collection<any>('service_offerings')
      .find({ site_id: { $in: idVariants(asStringId(site._id)) }, visible_public: true } as any, {
        projection: {
          _id: 1,
          catalog_service_id: 1,
          public_title: 1,
          public_description: 1,
          base_price: 1,
          currency: 1,
          active: 1,
        },
      })
      .toArray();

    const catalogIds = Array.from(new Set(offerings.map((o: any) => o.catalog_service_id).filter(Boolean)));
    const catalogIdVariants = catalogIds.flatMap((id: unknown) => idVariants(asStringId(id)));
    const catalogs = catalogIdVariants.length
      ? await this.connection.collection<any>('catalog_services').find({ _id: { $in: catalogIdVariants } } as any).toArray()
      : [];
    const catalogById = new Map(catalogs.map((c: any) => [asStringId(c._id), c]));

    const categoryIds = Array.from(new Set(catalogs.map((c: any) => c.category_id).filter(Boolean)));
    const categoryIdVariants = categoryIds.flatMap((id: unknown) => idVariants(asStringId(id)));
    const categories = categoryIdVariants.length
      ? await this.connection.collection<any>('service_categories').find({ _id: { $in: categoryIdVariants } } as any, { projection: { _id: 1, name: 1 } }).toArray()
      : [];
    const categoryNameById = new Map(categories.map((c: any) => [asStringId(c._id), String(c.name ?? 'General')]));

    return offerings.map((o: any) => {
      const catalog = catalogById.get(asStringId(o.catalog_service_id));
      const categoryName = catalog ? categoryNameById.get(asStringId(catalog.category_id)) ?? 'General' : 'General';
      const durationMinutes = Number(catalog?.default_duration_minutes ?? 45);
      const basePrice = Number(o.base_price ?? 0);
      return {
        id: asStringId(o._id),
        category: categoryName,
        title: String(o.public_title ?? catalog?.name ?? 'Servicio'),
        description: String(o.public_description ?? catalog?.description ?? ''),
        durationMinutes,
        basePrice,
        promoPrice: undefined,
        badge: o.active === false ? 'No disponible' : undefined,
        features: [],
        priceToPay: basePrice,
      };
    });
  }

  async getBooking(input: { bookingId: string }) {
    const bookingUuid = asUuid(input.bookingId);
    if (!bookingUuid) throw new BadRequestException('bookingId must be a valid UUID');

    const booking = await this.connection.collection<any>('public_bookings').findOne({ _id: bookingUuid as any } as any);
    if (!booking) return null;

    const site = booking.site_id
      ? await this.findSiteDoc(asStringId(booking.site_id))
      : null;

    const payment = booking.payment_id
      ? await this.connection.collection<any>('public_payments').findOne({ _id: booking.payment_id as any } as any)
      : null;

    return {
      id: asStringId(booking._id),
      siteId: asStringId(booking.site_id),
      serviceId: asStringId(booking.service_id),
      serviceName: String(booking.service_name ?? ''),
      serviceCategory: String(booking.service_category ?? ''),
      patientName: String(booking.patient_name ?? ''),
      patientEmail: String(booking.patient_email ?? ''),
      patientPhone: String(booking.patient_phone ?? ''),
      patientDocumentType: String(booking.patient_document_type ?? ''),
      patientDocumentNumber: String(booking.patient_document_number ?? ''),
      billingMode: String(booking.billing_mode ?? 'FULL'),
      installmentCount: Number(booking.installment_count ?? 1),
      totalTreatmentPrice: Number(booking.total_treatment_price ?? booking.quoted_price ?? 0),
      notes: String(booking.notes ?? ''),
      quotedPrice: Number(booking.quoted_price ?? 0),
      appointmentStartAt: booking.appointment_start_at ? new Date(booking.appointment_start_at).toISOString() : '',
      appointmentEndAt: booking.appointment_end_at ? new Date(booking.appointment_end_at).toISOString() : '',
      status: String(booking.status ?? ''),
      expiresAt: booking.expires_at ? new Date(booking.expires_at).toISOString() : null,
      appointmentId: booking.appointment_id ? asStringId(booking.appointment_id) : null,
      professionalId: booking.professional_id ? asStringId(booking.professional_id) : null,
      timezone: String(site?.timezone ?? 'UTC'),
      payment: payment
        ? {
            id: asStringId(payment._id),
            providerKey: String(payment.provider_key ?? 'UNKNOWN'),
            providerReference: String(payment.provider_reference ?? ''),
            amount: Number(payment.amount ?? 0),
            currency: String(payment.currency ?? 'COP'),
            status: String(payment.status ?? 'PENDING'),
            providerStatus: String(payment.provider_status ?? payment.status ?? 'PENDING'),
            checkoutUrl: payment.checkout_url ? String(payment.checkout_url) : null,
            clientSecret: payment.client_secret ? String(payment.client_secret) : null,
            failureReason: payment.failure_reason ? String(payment.failure_reason) : null,
            expiresAt: payment.expires_at ? new Date(payment.expires_at).toISOString() : null,
            confirmationPath: `/booking/confirmation/${asStringId(booking._id)}`,
            gatewayHint: payment.gateway_redirect_hint ? String(payment.gateway_redirect_hint) : null,
          }
        : null,
    };
  }
}

