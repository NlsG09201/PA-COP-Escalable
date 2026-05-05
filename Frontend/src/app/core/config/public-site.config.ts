export const PUBLIC_SITE_URL =
  (globalThis as { __env?: { PUBLIC_SITE_URL?: string } }).__env?.PUBLIC_SITE_URL ??
  'http://localhost:5174';

