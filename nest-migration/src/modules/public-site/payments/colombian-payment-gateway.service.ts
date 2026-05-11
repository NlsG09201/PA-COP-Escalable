import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  COLOMBIA_CHECKOUT_PROVIDER_KEYS,
  ColombiaCheckoutProviderKey,
  DEFAULT_WOMPI_PSE_INSTITUTION_CODE,
} from './colombian-payment.constants';

export type ResolveCheckoutInput = {
  bookingId: string;
  amountPesos: number;
  customerEmail: string;
  providerKey: string;
  idempotencyKey?: string | null;
  /** Teléfono Nequi/Daviplata (10 dígitos aprox.). */
  walletPhone?: string;
  /** PSE: documento pagador */
  pseLegalId?: string;
  pseLegalIdType?: string;
  pseUserType?: 'PERSON' | 'BUSINESS';
  /** Tarjeta tokenizada por el PSP (p. ej. Widget Wompi). */
  cardPaymentSourceToken?: string;
  wompiAcceptanceToken?: string;
  wompiPersonalAuth?: string;
};

export type ResolveCheckoutResult = {
  providerReference: string;
  checkoutUrl: string;
  externalTransactionId?: string;
  integritySignature?: string;
  redirectHint?: string;
};

@Injectable()
export class ColombianPaymentGatewayService {
  private readonly logger = new Logger(ColombianPaymentGatewayService.name);

  normalizeProvider(raw?: string): ColombiaCheckoutProviderKey {
    const k = String(raw ?? 'SANDBOX').trim().toUpperCase();
    const hit = COLOMBIA_CHECKOUT_PROVIDER_KEYS.find((x) => x === k);
    if (!hit) {
      throw new BadRequestException(
        `Proveedor de pago invalido: ${raw}. Consulte GET /public/payments/methods`,
      );
    }
    return hit;
  }

  /**
   * Resuelve URL de cobro (sandbox interno vs transacción Wompi cuando hay llaves).
   */
  async resolveCheckout(ctx: ResolveCheckoutInput): Promise<ResolveCheckoutResult> {
    const method = ctx.providerKey;

    const webOrigin = this.publicWebOrigin();
    const sandboxUrl = `${webOrigin}/public/payments/sandbox/${encodeURIComponent(ctx.bookingId)}`;

    const privateKey = process.env.WOMPI_PRIVATE_KEY ?? '';
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET ?? '';
    const publicKey = process.env.WOMPI_PUBLIC_KEY ?? '';

    if (method === 'SANDBOX' || !privateKey || !integritySecret || !publicKey) {
      const providerReference = `sandbox-${ctx.bookingId}-${crypto.randomUUID()}`;
      return {
        providerReference,
        checkoutUrl: `${sandboxUrl}?intent=${encodeURIComponent(providerReference)}&method=${encodeURIComponent(method)}`,
        redirectHint: 'SANDBOX',
      };
    }

    if (!ctx.wompiAcceptanceToken || !ctx.wompiPersonalAuth) {
      throw new BadRequestException(
        'Para pagos reales con Wompi debe aceptarse terminos del PSP. Consulte GET /public/payments/wompi-presets y envie wompiAcceptanceToken / wompiPersonalAuth tras el checkbox del usuario.',
      );
    }

    const reference = `cop_${ctx.bookingId.slice(0, 22)}_${crypto.randomBytes(6).toString('hex')}`.slice(0, 64);
    const amount_in_cents = this.pesosToWompiCents(ctx.amountPesos);
    const integrity = crypto
      .createHash('sha256')
      .update(`${reference}${amount_in_cents}COP${integritySecret}`)
      .digest('hex');

    const body = this.buildWompiBody(ctx, reference, amount_in_cents, integrity);
    const base = process.env.WOMPI_ENV === 'production' ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';

    const res = await fetch(`${base}/transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${privateKey}`,
        'Content-Type': 'application/json',
        ...(ctx.idempotencyKey ? { 'Idempotency-Key': ctx.idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      this.logger.warn(`Wompi transaction rejected (${res.status}): ${text.slice(0, 500)}`);
      throw new BadRequestException(json?.error?.reason ?? json?.error?.message ?? `Wompi rechazo (${res.status})`);
    }

    const data = json?.data ?? json;
    const id = String(data?.id ?? '');
    const pm = data?.payment_method ?? {};
    const extra = typeof pm.extra === 'object' && pm.extra ? pm.extra : {};
    const redirect =
      String(data?.redirect_url ?? extra.async_payment_url ?? extra.three_ds_auth_url ?? extra.external_resource_url ?? '') ||
      null;

    if (redirect && redirect.startsWith('http')) {
      return {
        providerReference: reference,
        checkoutUrl: redirect,
        externalTransactionId: id || undefined,
        integritySignature: integrity,
        redirectHint: 'WOMPI_EXTERNAL',
      };
    }

    // Sin URL externa clara — devolver sandbox de seguimiento con id de tx Wompi
    return {
      providerReference: reference,
      checkoutUrl: `${sandboxUrl}?intent=${encodeURIComponent(reference)}&method=${encodeURIComponent(method)}&wompiTxn=${encodeURIComponent(id)}`,
      externalTransactionId: id || undefined,
      integritySignature: integrity,
      redirectHint: 'WOMPI_STATUS',
    };
  }

  private publicWebOrigin(): string {
    return (process.env.PUBLIC_WEB_ORIGIN ?? 'http://localhost:5174').replace(/\/$/, '');
  }

  private pesosToWompiCents(pesos: number): number {
    const n = Number(pesos);
    if (!Number.isFinite(n) || n <= 0) throw new BadRequestException('Monto de reserva invalido');
    return Math.max(100, Math.round(n * 100));
  }

  private buildWompiBody(ctx: ResolveCheckoutInput, reference: string, amount_in_cents: number, signature: string) {
    const isSandbox = process.env.WOMPI_ENV !== 'production';
    const email = String(ctx.customerEmail || 'cliente+cop@example.com');

    const base: Record<string, unknown> = {
      acceptance_token: ctx.wompiAcceptanceToken,
      accept_personal_auth: ctx.wompiPersonalAuth,
      amount_in_cents,
      currency: 'COP',
      signature,
      reference,
      customer_email: email,
    };

    const method = ctx.providerKey;
    switch (method) {
      case 'NEQUI':
        if (!ctx.walletPhone?.trim()) throw new BadRequestException('Se requiere walletPhone para Nequi');
        return {
          ...base,
          payment_method: {
            type: 'NEQUI',
            phone_number: String(ctx.walletPhone).trim(),
            ...(isSandbox ? { sandbox_status: process.env.WOMPI_SANDBOX_NEQUI_STATUS ?? 'APPROVED' } : {}),
          },
        };
      case 'DAVIPLATA':
        if (!ctx.walletPhone?.trim()) throw new BadRequestException('Se requiere walletPhone para Daviplata');
        return {
          ...base,
          payment_method: {
            type: 'DAVIPLATA',
            phone_number: String(ctx.walletPhone).trim(),
            ...(isSandbox ? { sandbox_status: process.env.WOMPI_SANDBOX_DAVIPLATA_STATUS ?? 'APPROVED' } : {}),
          },
        };
      case 'PSE_BANCOLOMBIA':
      case 'PSE_BBVA_COL':
      case 'PSE_BANCO_BOGOTA':
      case 'PSE_DAVIVIENDA': {
        let code = DEFAULT_WOMPI_PSE_INSTITUTION_CODE[method];
        if (!code) throw new BadRequestException('Codigo PSE no configurado');
        if (isSandbox) {
          code = process.env.WOMPI_SANDBOX_PSE_BANK_CODE ?? '1';
        }
        const document = String(ctx.pseLegalId ?? '').trim();
        if (!document) throw new BadRequestException('pseLegalId requerido para PSE');
        const description = (`Cita ${reference}`).slice(0, 30);
        const userType = ctx.pseUserType === 'BUSINESS' ? 1 : 0;
        return {
          ...base,
          payment_method: {
            type: 'PSE',
            user_type: userType,
            payment_description: description,
            financial_institution_code: code,
            user_legal_id: document,
            user_legal_id_type: ctx.pseLegalIdType ?? 'CC',
          },
        };
      }
      case 'CARD_TOKEN': {
        const token = String(ctx.cardPaymentSourceToken ?? '').trim();
        if (!token) throw new BadRequestException('cardPaymentSourceToken requerido para tarjetas tokenizadas');
        return {
          ...base,
          payment_method: {
            type: 'CARD',
            token,
            installments: 1,
          },
        };
      }
      default:
        throw new BadRequestException('Metodo no soportado por Wompi');
    }
  }

  /** GET /merchants/:publicKey desde Wompi (tokens de contratos). */
  async fetchWompiMerchantPresets() {
    const publicKey = process.env.WOMPI_PUBLIC_KEY ?? '';
    if (!publicKey) throw new BadRequestException('WOMPI_PUBLIC_KEY no configurado');
    const base = process.env.WOMPI_ENV === 'production' ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';
    const res = await fetch(`${base}/merchants/${encodeURIComponent(publicKey)}`);
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      throw new BadRequestException(`No se pudieron obtener terminos del comercio Wompi (${res.status})`);
    }
    const d = json?.data ?? json;
    return {
      merchantPublicKey: publicKey,
      acceptanceToken: d?.presigned_acceptance?.acceptance_token ?? d?.presigned_acceptance?.acceptanceToken,
      acceptPersonalAuth: d?.presigned_personal_data_auth?.acceptance_token ?? d?.presigned_personal_data_auth?.acceptanceToken,
      termsPrivacyUrl: d?.presigned_acceptance?.permalink,
      termsDataUrl: d?.presigned_personal_data_auth?.permalink,
      environment: process.env.WOMPI_ENV === 'production' ? 'production' : 'sandbox',
    };
  }
}
