import { HttpErrorResponse } from '@angular/common/http';

export function extractHttpErrorMessage(err: unknown, fallback = 'Error'): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as unknown;
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const msg = (body as { message: unknown }).message;
      if (Array.isArray(msg)) return msg.map(String).join(', ');
      if (typeof msg === 'string' && msg.trim()) return msg.trim();
    }
    if (typeof body === 'string' && body.trim()) return body.trim();
    if (err.status === 502 || err.status === 503) {
      return 'El servidor no responde (502/503). Espera unos segundos y reintenta.';
    }
    if (err.status === 0) return 'Sin conexión al API. Verifica que el gateway esté activo.';
    if (err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
