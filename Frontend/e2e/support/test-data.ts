export const automationConfig = {
  adminUsername: process.env.PLAYWRIGHT_ADMIN_USERNAME ?? 'admin@cop.local',
  adminPassword: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'Admin123ChangeMe'
};

export type PatientData = {
  patientName: string;
  email: string;
  phone: string;
  notes: string;
};

export function buildPatientData(prefix = 'QA'): PatientData {
  const nonce = Date.now().toString().slice(-6);
  const compactPrefix = prefix.replace(/\s+/g, '').toLowerCase();

  return {
    patientName: `${prefix} Automation ${nonce}`,
    email: `${compactPrefix}.automation.${nonce}@example.com`,
    phone: `300${nonce.padStart(7, '0').slice(0, 7)}`,
    notes: `${prefix} browser automation run ${nonce}`
  };
}
