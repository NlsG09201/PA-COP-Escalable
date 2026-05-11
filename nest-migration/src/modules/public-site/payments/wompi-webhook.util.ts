import * as crypto from 'crypto';

/** Lee `transaction.id` desde `data` anidado. */
export function getByPropertyPath(data: unknown, path: string): unknown {
  if (data == null || typeof data !== 'object') return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, data as Record<string, unknown>);
}

/**
 * Firma de eventos Wompi: valores en orden `signature.properties`, + `timestamp`, + secreto de eventos.
 * @see https://docs.wompi.co/docs/colombia/eventos/
 */
export function verifyWompiEventChecksum(body: Record<string, unknown>, eventsSecret: string): boolean {
  const sig = body['signature'];
  const ts = body['timestamp'];
  if (!sig || typeof sig !== 'object' || ts === undefined || ts === null) return false;

  const properties = (sig as { properties?: unknown }).properties;
  const checksum = (sig as { checksum?: unknown }).checksum;
  if (!Array.isArray(properties) || typeof checksum !== 'string' || !eventsSecret) return false;

  const data = body['data'];
  let concat = '';
  for (const prop of properties) {
    if (typeof prop !== 'string') return false;
    const v = getByPropertyPath(data, prop);
    if (v === undefined || v === null) concat += '';
    else if (typeof v === 'object') return false;
    else concat += String(v);
  }
  concat += String(ts);
  concat += eventsSecret;

  const hex = crypto.createHash('sha256').update(concat, 'utf8').digest('hex').toUpperCase();
  return hex === String(checksum).trim().toUpperCase();
}

export type WompiPaymentStatus = 'PAID' | 'FAILED' | 'REQUIRES_ACTION' | 'PENDING';

export function mapWompiTransactionToInternalStatus(wompiStatus: string): WompiPaymentStatus {
  const u = String(wompiStatus ?? '').toUpperCase().trim();
  if (u === 'APPROVED') return 'PAID';
  if (u === 'DECLINED' || u === 'VOIDED' || u === 'ERROR') return 'FAILED';
  if (u.includes('PENDING')) return 'REQUIRES_ACTION';
  return 'PENDING';
}

export function extractWompiTransaction(body: Record<string, unknown>): Record<string, unknown> | null {
  if (String(body['event'] ?? '') !== 'transaction.updated') return null;
  const data = body['data'];
  if (!data || typeof data !== 'object') return null;
  const tx = (data as { transaction?: unknown }).transaction;
  if (!tx || typeof tx !== 'object') return null;
  return tx as Record<string, unknown>;
}
