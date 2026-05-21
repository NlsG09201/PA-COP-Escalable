/** Panel Next.js (Weka AI Lab y módulos enterprise). */
export const DASHBOARD_NEXT_URL = (() => {
  const raw = (globalThis as { __env?: { DASHBOARD_URL?: string } }).__env?.DASHBOARD_URL;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().replace(/\/$/, '');
  }
  return 'https://cop-web-dashboard.onrender.com';
})();

export const WEKA_AI_LAB_URL = `${DASHBOARD_NEXT_URL}/weka-ai-lab`;
