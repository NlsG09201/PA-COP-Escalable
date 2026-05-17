import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { UUID } from 'bson';
import { Connection } from 'mongoose';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';

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

function normalizeCoPhone(raw: string): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length >= 10) {
    if (digits.startsWith('57')) return `+${digits}`;
    return `+57${digits.slice(-10)}`;
  }
  return null;
}

@Injectable()
export class BookingNotificationsService {
  private readonly log = new Logger(BookingNotificationsService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async notifyBookingConfirmed(bookingId: string): Promise<void> {
    const bookingUuid = asUuid(bookingId);
    if (!bookingUuid) return;

    const booking = await this.connection.collection<any>('public_bookings').findOne({ _id: bookingUuid as any } as any);
    if (!booking || String(booking.status ?? '') !== 'CONFIRMED') return;

    const when = booking.appointment_start_at ? new Date(booking.appointment_start_at).toISOString() : '';
    const service = String(booking.service_name ?? 'Cita');
    const patient = String(booking.patient_name ?? '');
    const subject = `Cita confirmada — ${service}`;
    const text = [
      `Hola ${patient || 'paciente'},`,
      '',
      `Tu cita quedó confirmada.`,
      `Servicio: ${service}`,
      `Fecha y hora (UTC/ISO): ${when}`,
      '',
      `Referencia de reserva: ${asStringId(booking._id)}`,
      '',
      'Gracias por confiar en nosotros.',
    ].join('\n');

    const email = String(booking.patient_email ?? '').trim();
    const phone = String(booking.patient_phone ?? '').trim();

    await Promise.all([
      email ? this.tryEmail(bookingUuid, email, subject, text) : Promise.resolve(),
      phone ? this.tryWhatsapp(bookingUuid, phone, text) : Promise.resolve(),
    ]);
  }

  private async alreadySent(bookingUuid: UUID, channel: string): Promise<boolean> {
    const one = await this.connection.collection<any>('public_notification_logs').findOne({
      booking_id: bookingUuid as any,
      channel,
      template_code: 'BOOKING_CONFIRMED',
      status: 'SENT',
    } as any);
    return !!one;
  }

  private async tryEmail(bookingUuid: UUID, to: string, subject: string, text: string): Promise<void> {
    if (await this.alreadySent(bookingUuid, 'EMAIL')) return;
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS')?.trim();
    const from = this.config.get<string>('SMTP_FROM')?.trim() || user;
    const port = Number(this.config.get<string>('SMTP_PORT') ?? '587');
    const secure = String(this.config.get<string>('SMTP_SECURE') ?? '').toLowerCase() === 'true';

    if (!host || !user || !pass || !from) {
      await this.writeLog(bookingUuid, 'EMAIL', to, 'BOOKING_CONFIRMED', 'SKIPPED', null, 'SMTP not configured');
      return;
    }

    try {
      const transport = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
      const info = await transport.sendMail({ from, to, subject, text });
      await this.writeLog(bookingUuid, 'EMAIL', to, 'BOOKING_CONFIRMED', 'SENT', String(info.messageId ?? ''), null);
    } catch (e: any) {
      this.log.warn(`Email notify failed: ${e?.message ?? e}`);
      await this.writeLog(bookingUuid, 'EMAIL', to, 'BOOKING_CONFIRMED', 'FAILED', null, String(e?.message ?? e));
    }
  }

  private async tryWhatsapp(bookingUuid: UUID, phoneRaw: string, text: string): Promise<void> {
    if (await this.alreadySent(bookingUuid, 'WHATSAPP')) return;
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID')?.trim();
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN')?.trim();
    const from = this.config.get<string>('TWILIO_WHATSAPP_FROM')?.trim();

    const e164 = normalizeCoPhone(phoneRaw);
    if (!sid || !token || !from || !e164) {
      await this.writeLog(
        bookingUuid,
        'WHATSAPP',
        phoneRaw,
        'BOOKING_CONFIRMED',
        'SKIPPED',
        null,
        !sid || !token || !from ? 'Twilio not configured' : 'Invalid phone',
      );
      return;
    }

    const to = e164.startsWith('whatsapp:') ? e164 : `whatsapp:${e164}`;
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const body = new URLSearchParams();
    body.set('From', from.startsWith('whatsapp:') ? from : `whatsapp:${from}`);
    body.set('To', to);
    body.set('Body', text.slice(0, 1500));

    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        const err = String(json['message'] ?? json['more_info'] ?? res.statusText);
        await this.writeLog(bookingUuid, 'WHATSAPP', to, 'BOOKING_CONFIRMED', 'FAILED', null, err);
        return;
      }
      const mid = String(json['sid'] ?? '');
      await this.writeLog(bookingUuid, 'WHATSAPP', to, 'BOOKING_CONFIRMED', 'SENT', mid, null);
    } catch (e: any) {
      this.log.warn(`WhatsApp notify failed: ${e?.message ?? e}`);
      await this.writeLog(bookingUuid, 'WHATSAPP', to, 'BOOKING_CONFIRMED', 'FAILED', null, String(e?.message ?? e));
    }
  }

  private async writeLog(
    bookingId: UUID,
    channel: string,
    recipient: string,
    templateCode: string,
    status: string,
    providerMessageId: string | null,
    errorMessage: string | null,
  ): Promise<void> {
    const _id = new UUID(crypto.randomUUID());
    await this.connection.collection<any>('public_notification_logs').insertOne({
      _id,
      booking_id: bookingId,
      channel,
      recipient,
      template_code: templateCode,
      template_payload: { kind: 'BOOKING_CONFIRMED' },
      status,
      attempt_count: 1,
      provider_message_id: providerMessageId,
      error_message: errorMessage,
      sent_at: status === 'SENT' ? new Date() : null,
      created_at: new Date(),
    });
  }
}
