export const automationConfig = {
  dashboardBaseUrl: process.env.PLAYWRIGHT_DASHBOARD_BASE_URL ?? 'http://localhost:5173',
  adminUsername: process.env.PLAYWRIGHT_ADMIN_USERNAME ?? 'nelsonh09',
  adminPassword: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'NelsonH09092001'
};

export type PatientData = {
  patientName: string;
  email: string;
  phone: string;
  documentType: string;
  documentNumber: string;
};

export function buildPatientData(prefix = 'QA'): PatientData {
  const nonce = Date.now().toString().slice(-6);
  const compactPrefix = prefix.replace(/\s+/g, '').toLowerCase();

  return {
    patientName: `${prefix} Automation ${nonce}`,
    email: `${compactPrefix}.automation.${nonce}@example.com`,
    phone: `300${nonce.padStart(7, '0').slice(0, 7)}`,
    documentType: 'CC',
    documentNumber: `1${nonce.padStart(9, '0').slice(0, 9)}`,
  };
}
