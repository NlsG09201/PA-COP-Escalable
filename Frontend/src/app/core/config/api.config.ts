export const API_BASE_URL =
  (globalThis as { __env?: { API_BASE_URL?: string } }).__env?.API_BASE_URL ??
  'http://localhost:8080';
