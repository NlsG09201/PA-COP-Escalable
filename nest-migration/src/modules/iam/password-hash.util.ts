/**
 * Normaliza password_hash desde Mongo (string, Binary, legacy Spring {bcrypt}).
 */
export function extractPasswordHash(hash: unknown): string {
  if (hash == null) return '';

  if (Buffer.isBuffer(hash)) {
    return hash.toString('utf8');
  }

  if (typeof hash === 'object') {
    const o = hash as Record<string, unknown>;
    if (typeof o.toString === 'function') {
      const s = String(o);
      if (s.startsWith('$2')) return s;
    }
    if (Buffer.isBuffer(o.buffer)) {
      return Buffer.from(o.buffer).toString('utf8');
    }
  }

  const h = String(hash);
  if (h.startsWith('{bcrypt}')) return h.slice('{bcrypt}'.length);
  return h;
}
