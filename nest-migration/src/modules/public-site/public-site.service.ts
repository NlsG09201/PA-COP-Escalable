import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { UUID } from 'bson';
import * as crypto from 'crypto';
import { Connection } from 'mongoose';

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

@Injectable()
export class PublicSiteService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  private async findOrCreatePatient(input: {
    organizationId: any;
    siteId: any;
    fullName: string;
    email?: string;
    phone?: string;
  }): Promise<{ _id: UUID }> {
    const email = String(input.email ?? '').trim().toLowerCase();
    const phone = String(input.phone ?? '').trim();

    const match: any = { organization_id: input.organizationId };
    if (input.siteId) match.site_id = input.siteId;

    // Prefer email match; fallback to phone.
    const patient =
      (email
        ? await this.connection.collection<any>('patients').findOne({ ...match, email } as any)
        : null) ??
      (phone
        ? await this.connection.collection<any>('patients').findOne({ ...match, phone } as any)
        : null);

    if (patient?._id) {
      // Best-effort refresh of contact info/name if missing.
      await this.connection.collection<any>('patients').updateOne(
        { _id: patient._id } as any,
        {
          $set: {
            full_name: String(input.fullName ?? patient.full_name ?? '').trim() || patient.full_name,
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
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
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
    });

    return { _id: patientId };
  }

  async availability(input: { siteId: string; serviceId: string; fromDate?: string }) {
    const siteUuid = asUuid(input.siteId);
    if (!siteUuid) throw new BadRequestException('siteId must be a valid UUID');
    if (!input.serviceId) throw new BadRequestException('serviceId is required');

    const offeringUuid = asUuid(input.serviceId);
    if (!offeringUuid) throw new BadRequestException('serviceId must be a valid UUID');

    const site = await this.connection.collection<any>('sites').findOne({ _id: siteUuid as any } as any);
    if (!site) throw new BadRequestException('siteId not found');

    const offering = await this.connection.collection<any>('service_offerings').findOne({ _id: offeringUuid as any } as any);
    if (!offering) throw new BadRequestException('serviceId not found');

    const catalog = offering.catalog_service_id
      ? await this.connection.collection<any>('catalog_services').findOne({ _id: offering.catalog_service_id as any } as any)
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

    const profIds = professionals.map((p: any) => p._id);
    const busy = await this.connection
      .collection<any>('appointments')
      .find(
        {
          site_id: site._id,
          professional_id: { $in: profIds },
          start_at: { $lt: rangeEndUtc },
          end_at: { $gt: rangeStartUtc },
          status: { $in: ['REQUESTED', 'CONFIRMED', 'COMPLETED'] },
        } as any,
        { projection: { professional_id: 1, start_at: 1, end_at: 1 } },
      )
      .toArray();

    const busyByProf = new Map<string, Array<{ start: Date; end: Date }>>();
    for (const b of busy) {
      const key = asStringId(b.professional_id);
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

        for (const p of professionals) {
          const pid = asStringId(p._id);
          const ranges = busyByProf.get(pid) ?? [];
          const overlaps = ranges.some((r) => startAt < r.end && endAt > r.start);
          if (overlaps) continue;

          slots.push({
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            professionalId: pid,
            professionalName: String(p.full_name ?? 'Profesional'),
          });
        }
      }
    }

    // Limit to keep UI fast.
    return { siteId: input.siteId, serviceId: input.serviceId, slots: slots.slice(0, 200) };
  }

  async quoteBooking(input: { siteId?: string; serviceId?: string; slotStartAt?: string }) {
    const siteUuid = asUuid(input.siteId);
    if (!siteUuid) throw new BadRequestException('siteId must be a valid UUID');
    if (!input.serviceId) throw new BadRequestException('serviceId is required');
    if (!input.slotStartAt) throw new BadRequestException('slotStartAt is required');

    const startAt = new Date(input.slotStartAt);
    if (Number.isNaN(startAt.getTime())) throw new BadRequestException('slotStartAt must be a valid ISO date');

    const site = await this.connection.collection<any>('sites').findOne({ _id: siteUuid as any } as any);
    if (!site) throw new BadRequestException('siteId not found');

    const offeringUuid = asUuid(input.serviceId);
    if (!offeringUuid) throw new BadRequestException('serviceId must be a valid UUID');

    const offering = await this.connection.collection<any>('service_offerings').findOne({ _id: offeringUuid as any } as any);
    if (!offering) throw new BadRequestException('serviceId not found');

    const catalogItem = offering.catalog_service_id
      ? await this.connection.collection<any>('catalog_services').findOne({ _id: offering.catalog_service_id as any } as any)
      : null;

    const category = catalogItem?.category_id
      ? await this.connection.collection<any>('service_categories').findOne({ _id: catalogItem.category_id as any } as any)
      : null;

    const durationMinutes = Number(catalogItem?.default_duration_minutes ?? 45);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

    const basePrice = Number(offering.base_price ?? 0);
    const promoPrice = undefined;
    const quotedPrice = basePrice;

    // Best-effort professional: pick the first available one for this slot.
    const availability = await this.availability({ siteId: asStringId(site._id), serviceId: asStringId(offering._id), fromDate: startAt.toISOString().slice(0, 10) });
    const matchSlot = availability.slots.find((s) => s.startAt === startAt.toISOString()) ?? availability.slots[0];

    return {
      siteId: asStringId(site._id),
      siteName: String(site.name ?? 'Sede'),
      serviceId: asStringId(offering._id),
      serviceName: String(offering.public_title ?? catalogItem?.name ?? 'Servicio'),
      serviceCategory: String(category?.name ?? 'General'),
      slotStartAt: startAt.toISOString(),
      slotEndAt: endAt.toISOString(),
      professionalId: matchSlot?.professionalId ?? '',
      professionalName: matchSlot?.professionalName ?? 'Profesional',
      basePrice,
      promoPrice,
      quotedPrice,
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
    idempotencyKey?: string;
  }) {
    const siteUuid = asUuid(input.siteId);
    if (!siteUuid) throw new BadRequestException('siteId must be a valid UUID');
    if (!input.serviceId) throw new BadRequestException('serviceId is required');
    if (!input.slotStartAt) throw new BadRequestException('slotStartAt is required');

    const startAt = new Date(input.slotStartAt);
    if (Number.isNaN(startAt.getTime())) throw new BadRequestException('slotStartAt must be a valid ISO date');

    const site = await this.connection.collection<any>('sites').findOne({ _id: siteUuid as any } as any);
    if (!site) throw new BadRequestException('siteId not found');

    const offeringUuid = asUuid(input.serviceId);
    if (!offeringUuid) throw new BadRequestException('serviceId must be a valid UUID');

    const offering = await this.connection.collection<any>('service_offerings').findOne({ _id: offeringUuid as any } as any);
    if (!offering) throw new BadRequestException('serviceId not found');

    const catalogItem = offering.catalog_service_id
      ? await this.connection.collection<any>('catalog_services').findOne({ _id: offering.catalog_service_id as any } as any)
      : null;

    const category = catalogItem?.category_id
      ? await this.connection.collection<any>('service_categories').findOne({ _id: catalogItem.category_id as any } as any)
      : null;

    const durationMinutes = Number(catalogItem?.default_duration_minutes ?? 45);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

    const bookingId = new UUID(crypto.randomUUID());

    // Choose professional from availability for the selected slot.
    const availability = await this.availability({ siteId: asStringId(site._id), serviceId: asStringId(offering._id), fromDate: startAt.toISOString().slice(0, 10) });
    const selectedSlot = availability.slots.find((s) => s.startAt === startAt.toISOString());
    const professionalUuid = selectedSlot?.professionalId ? asUuid(selectedSlot.professionalId) : undefined;

    // Create or reuse patient (so it appears in dashboard).
    const patient = await this.findOrCreatePatient({
      organizationId: site.organization_id,
      siteId: site._id,
      fullName: String(input.patientName ?? '').trim(),
      email: input.email,
      phone: input.phone,
    });

    const appointmentId = new UUID(crypto.randomUUID());
    const quotedPrice = Number(offering.base_price ?? 0);

    // Create an appointment as a soft hold (REQUESTED).
    await this.connection.collection<any>('appointments').insertOne({
      _id: appointmentId,
      professional_id: professionalUuid ?? null,
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
      notes: String(input.notes ?? ''),
      quoted_price: quotedPrice,
      appointment_start_at: startAt,
      appointment_end_at: endAt,
      status: 'PENDING_PAYMENT',
      professional_id: professionalUuid ?? null,
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

  async bookingNotifications(input: { bookingId: string }) {
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

  async createPaymentIntent(input: { bookingId: string; providerKey?: string; idempotencyKey?: string }) {
    const bookingUuid = asUuid(input.bookingId);
    if (!bookingUuid) throw new BadRequestException('bookingId must be a valid UUID');

    const booking = await this.connection.collection<any>('public_bookings').findOne({ _id: bookingUuid as any } as any);
    if (!booking) throw new BadRequestException('bookingId not found');

    const providerKey = String(input.providerKey ?? 'SANDBOX');
    const providerReference = `sandbox-${input.bookingId}-${crypto.randomUUID()}`;
    const paymentId = new UUID(crypto.randomUUID());
    const clientSecret = `sandbox_${crypto.randomUUID()}`;

    const paymentDoc: any = {
      _id: paymentId,
      booking_id: booking._id,
      provider_key: providerKey,
      provider_reference: providerReference,
      provider_status: 'REQUIRES_ACTION',
      checkout_url: `http://localhost:5174/public/payments/sandbox/${encodeURIComponent(input.bookingId)}?intent=${encodeURIComponent(providerReference)}`,
      client_secret: clientSecret,
      amount: booking.quoted_price ?? 0,
      currency: 'COP',
      status: 'REQUIRES_ACTION',
      idempotency_key: input.idempotencyKey ?? null,
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
      providerReference,
      amount: Number(paymentDoc.amount ?? 0),
      currency: 'COP',
      status: 'REQUIRES_ACTION',
      providerStatus: 'REQUIRES_ACTION',
      checkoutUrl: String(paymentDoc.checkout_url ?? null),
      clientSecret,
      failureReason: null,
      expiresAt: null,
      confirmationPath: `/booking/confirmation/${input.bookingId}`,
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
        { $set: { status: 'PAID', provider_status: 'approved', paid_at: new Date(), updated_at: new Date() } },
      );
    }

    await this.connection
      .collection<any>('public_bookings')
      .updateOne({ _id: booking._id }, { $set: { status: 'CONFIRMED', updated_at: new Date() } });

    // Promote appointment to CONFIRMED so it shows in dashboard filters.
    if (booking.appointment_id) {
      await this.connection.collection<any>('appointments').updateOne(
        { _id: booking.appointment_id } as any,
        { $set: { status: 'CONFIRMED', updated_at: new Date() } },
      );
    }

    return this.getBooking({ bookingId: input.bookingId });
  }

  async handlePaymentWebhook(input: {
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
      await this.connection.collection<any>('public_payments').updateOne(
        { _id: payment._id },
        {
          $set: {
            provider_key: String(input.providerKey ?? payment.provider_key ?? 'UNKNOWN'),
            provider_status: String(input.status ?? payment.provider_status ?? 'unknown'),
            status: String(input.status ?? payment.status ?? 'unknown').toUpperCase() === 'APPROVED' ? 'PAID' : String(payment.status ?? 'PENDING'),
            last_webhook_idempotency_key: input.idempotencyKey ?? input.eventId ?? null,
            updated_at: new Date(),
          },
        },
      );
    }

    if (bookingUuid) {
      // Reflect paid status on booking if webhook says approved.
      const normalized = String(input.status ?? '').toLowerCase();
      if (normalized === 'approved' || normalized === 'paid') {
        await this.connection
          .collection<any>('public_bookings')
          .updateOne({ _id: bookingUuid as any } as any, { $set: { status: 'CONFIRMED', updated_at: new Date() } });

        const booking = await this.connection.collection<any>('public_bookings').findOne({ _id: bookingUuid as any } as any);
        if (booking?.appointment_id) {
          await this.connection.collection<any>('appointments').updateOne(
            { _id: booking.appointment_id } as any,
            { $set: { status: 'CONFIRMED', updated_at: new Date() } },
          );
        }
      }
      return this.getBooking({ bookingId: input.bookingId! });
    }

    // Fallback: return booking if we can infer it from payment.
    const inferredBookingId = payment?.booking_id ? asStringId(payment.booking_id) : null;
    return inferredBookingId ? this.getBooking({ bookingId: inferredBookingId }) : null;
  }

  async listCatalog(input: { siteId?: string }) {
    // Catalog in legacy DB is organization-level. We still accept siteId to keep frontend contract stable.
    const siteUuid = asUuid(input.siteId);
    if (input.siteId && !siteUuid) throw new BadRequestException('siteId must be a valid UUID');

    if (!siteUuid) {
      // PublicWeb always sends siteId; keep behavior safe.
      return [];
    }

    const site = await this.connection.collection<any>('sites').findOne({ _id: siteUuid as any } as any);
    if (!site) throw new BadRequestException('siteId not found');

    const offerings = await this.connection
      .collection<any>('service_offerings')
      .find({ site_id: site._id, visible_public: true } as any, {
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
    const catalogs = catalogIds.length
      ? await this.connection.collection<any>('catalog_services').find({ _id: { $in: catalogIds } } as any).toArray()
      : [];
    const catalogById = new Map(catalogs.map((c: any) => [asStringId(c._id), c]));

    const categoryIds = Array.from(new Set(catalogs.map((c: any) => c.category_id).filter(Boolean)));
    const categories = categoryIds.length
      ? await this.connection.collection<any>('service_categories').find({ _id: { $in: categoryIds } } as any, { projection: { _id: 1, name: 1 } }).toArray()
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
      ? await this.connection.collection<any>('sites').findOne({ _id: booking.site_id as any } as any, { projection: { timezone: 1 } })
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
          }
        : null,
    };
  }
}

