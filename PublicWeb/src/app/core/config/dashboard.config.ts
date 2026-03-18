export const DASHBOARD_URL =
  (globalThis as { __env?: { DASHBOARD_URL?: string } }).__env?.DASHBOARD_URL ??
  'http://localhost:5173';
