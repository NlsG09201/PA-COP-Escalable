import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateStripeIntentDto } from './dto/create-stripe-intent.dto';
import { CreatePayPalOrderDto } from './dto/create-paypal-order.dto';

@Injectable()
export class PaymentsIntlService {
  listMethods() {
    const stripeEnabled = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
    const paypalEnabled = Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim());
    return {
      stripe: stripeEnabled,
      paypal: paypalEnabled,
      wompi: Boolean(process.env.WOMPI_PRIVATE_KEY?.trim()),
      sandbox: process.env.NODE_ENV !== 'production',
    };
  }

  async createStripePaymentIntent(dto: CreateStripeIntentDto) {
    const secret = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secret) throw new BadRequestException('Stripe no configurado');

    const amount = Math.max(1, Math.round(Number(dto.amountCents)));
    const currency = (dto.currency ?? 'usd').toLowerCase();

    const params = new URLSearchParams();
    params.set('amount', String(amount));
    params.set('currency', currency);
    params.set('automatic_payment_methods[enabled]', 'true');
    if (dto.bookingId) params.set('metadata[bookingId]', dto.bookingId);
    if (dto.patientEmail) params.set('receipt_email', dto.patientEmail);

    const res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new BadRequestException(String((data as any).error?.message ?? 'Error Stripe'));
    }

    return {
      provider: 'stripe',
      clientSecret: data.client_secret,
      paymentIntentId: data.id,
      amount,
      currency,
    };
  }

  async createPayPalOrder(dto: CreatePayPalOrderDto) {
    const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) throw new BadRequestException('PayPal no configurado');

    const base =
      process.env.PAYPAL_MODE === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new BadRequestException('No se pudo autenticar con PayPal');
    }

    const value = (Number(dto.amount) || 0).toFixed(2);
    const currency = (dto.currency ?? 'USD').toUpperCase();

    const orderRes = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: dto.bookingId ?? 'booking',
            amount: { currency_code: currency, value },
            description: dto.description ?? 'Cita médica Centro COP',
          },
        ],
        application_context: {
          return_url: dto.returnUrl,
          cancel_url: dto.cancelUrl,
          brand_name: 'Centro COP',
          user_action: 'PAY_NOW',
        },
      }),
    });

    const order = (await orderRes.json()) as Record<string, unknown>;
    if (!orderRes.ok) {
      throw new BadRequestException('Error al crear orden PayPal');
    }

    const approve = ((order as any).links as Array<{ rel: string; href: string }>)?.find((l) => l.rel === 'approve');

    return {
      provider: 'paypal',
      orderId: order.id,
      approveUrl: approve?.href,
      status: order.status,
    };
  }
}
