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
    if (err.status === 401) return 'Sesión inválida o falta contexto de clínica en el token (401).';
    if (err.status === 403) return 'Tu usuario no tiene permiso para esta acción (403).';
    if (err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
